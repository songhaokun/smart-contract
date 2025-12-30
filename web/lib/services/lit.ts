/**
 * Lit Protocol Service
 * Handles encryption and decryption using Lit Protocol
 * Pay-to-Decrypt functionality based on hasUserPurchased check
 */

import { LIT_NETWORK, getContractAddresses, CURRENT_CHAIN } from '@/lib/constants';
import type { LitMetadata, AccessControlCondition } from '@/lib/constants/types';

// Lit Protocol types
type LitNodeClient = InstanceType<typeof import('@lit-protocol/lit-node-client').LitNodeClient>;

// Singleton client instance
let litNodeClient: LitNodeClient | null = null;

/**
 * Get or create Lit Node Client
 */
async function getLitClient(): Promise<LitNodeClient> {
  if (litNodeClient) {
    return litNodeClient;
  }

  const { LitNodeClient } = await import('@lit-protocol/lit-node-client');
  
  litNodeClient = new LitNodeClient({
    litNetwork: LIT_NETWORK,
    debug: process.env.NODE_ENV === 'development',
  });

  await litNodeClient.connect();
  
  return litNodeClient;
}

/**
 * Create access control conditions for a product
 * Requires hasUserPurchased to return true
 */
export function createAccessControlConditions(
  productId: number
): AccessControlCondition[] {
  const addresses = getContractAddresses();
  const chain = CURRENT_CHAIN === 'mainnet' ? 'ethereum' : 'sepolia';

  return [
    {
      contractAddress: addresses.mneeMart,
      standardContractType: '', // Empty string for custom contract methods
      chain,
      method: 'hasUserPurchased',
      parameters: [':userAddress', String(productId)],
      returnValueTest: {
        comparator: '=',
        value: 'true',
      },
    },
  ];
}

/**
 * Encrypt a file using Lit Protocol
 */
export async function encryptFile(
  file: File,
  productId: number
): Promise<{
  encryptedBlob: Blob;
  litMetadata: LitMetadata;
}> {
  const client = await getLitClient();
  const { encryptFile: litEncryptFile } = await import('@lit-protocol/encryption');

  // Read file as array buffer
  const fileBuffer = await file.arrayBuffer();
  const fileBlob = new Blob([fileBuffer], { type: file.type });

  // Create access control conditions
  const accessControlConditions = createAccessControlConditions(productId);
  const chain = CURRENT_CHAIN === 'mainnet' ? 'ethereum' : 'sepolia';

  // Encrypt the file
  const { ciphertext, dataToEncryptHash } = await litEncryptFile(
    {
      accessControlConditions,
      file: fileBlob,
      chain,
    },
    client
  );

  // The ciphertext is already a Blob
  const encryptedBlob = new Blob([ciphertext], { type: 'application/octet-stream' });

  // Create Lit metadata (without encryptedSymmetricKey for newer Lit versions)
  const litMetadata: LitMetadata = {
    encryptedSymmetricKey: '', // Handled internally by Lit v3+
    accessControlConditions,
    chain,
    dataToEncryptHash,
  };

  return {
    encryptedBlob,
    litMetadata,
  };
}

/**
 * Decrypt a file using Lit Protocol
 * User must have purchased the product
 */
export async function decryptFile(
  encryptedBlob: Blob,
  litMetadata: LitMetadata,
  signer: {
    getAddress: () => Promise<string>;
    signMessage: (message: string) => Promise<string>;
  }
): Promise<Blob> {
  const client = await getLitClient();
  const { decryptToFile } = await import('@lit-protocol/encryption');
  const { LitAccessControlConditionResource, LitAbility } = await import('@lit-protocol/auth-helpers');
  const { createSiweMessageWithRecaps, generateAuthSig } = await import('@lit-protocol/auth-helpers');

  const walletAddress = await signer.getAddress();
  const chain = litMetadata.chain || 'ethereum';

  // Get latest blockhash for session signature
  const latestBlockhash = await client.getLatestBlockhash();

  // Create auth callback
  const authNeededCallback = async (params: {
    uri?: string;
    expiration?: string;
    resourceAbilityRequests?: Array<{ resource: { getResourceKey: () => string }; ability: string }>;
  }) => {
    if (!params.uri || !params.expiration || !params.resourceAbilityRequests) {
      throw new Error('Missing auth params');
    }

    const toSign = await createSiweMessageWithRecaps({
      uri: params.uri,
      expiration: params.expiration,
      resources: params.resourceAbilityRequests as Parameters<typeof createSiweMessageWithRecaps>[0]['resources'],
      walletAddress,
      nonce: latestBlockhash,
      litNodeClient: client,
    });

    const authSig = await generateAuthSig({
      signer: {
        getAddress: async () => walletAddress,
        signMessage: async (message: string) => signer.signMessage(message),
      } as Parameters<typeof generateAuthSig>[0]['signer'],
      toSign,
    });

    return authSig;
  };

  // Create resource for decryption
  const litResource = new LitAccessControlConditionResource('*');

  // Get session signatures
  const sessionSigs = await client.getSessionSigs({
    chain,
    resourceAbilityRequests: [
      {
        resource: litResource,
        ability: LitAbility.AccessControlConditionDecryption,
      },
    ],
    authNeededCallback,
  });

  // Convert Blob to base64 string for Lit Protocol
  // Note: We use chunked conversion to avoid "Maximum call stack size exceeded"
  // when dealing with large files (spread operator has argument limit)
  const arrayBuffer = await encryptedBlob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  
  // Convert Uint8Array to base64 in chunks to avoid stack overflow
  const CHUNK_SIZE = 8192;
  let binaryString = '';
  for (let i = 0; i < uint8Array.length; i += CHUNK_SIZE) {
    const chunk = uint8Array.subarray(i, Math.min(i + CHUNK_SIZE, uint8Array.length));
    binaryString += String.fromCharCode.apply(null, Array.from(chunk));
  }
  const ciphertext = btoa(binaryString);

  // Decrypt the file
  const decryptedData = await decryptToFile(
    {
      accessControlConditions: litMetadata.accessControlConditions,
      chain,
      ciphertext,
      dataToEncryptHash: litMetadata.dataToEncryptHash,
      sessionSigs,
    },
    client
  );

  // Convert Uint8Array to Blob - copy to new ArrayBuffer to ensure correct type
  const outputBuffer = new ArrayBuffer(decryptedData.byteLength);
  new Uint8Array(outputBuffer).set(decryptedData);
  return new Blob([outputBuffer]);
}

/**
 * Disconnect from Lit Network
 */
export async function disconnectLit(): Promise<void> {
  if (litNodeClient) {
    await litNodeClient.disconnect();
    litNodeClient = null;
  }
}

/**
 * Check if connected to Lit Network
 */
export function isLitConnected(): boolean {
  return litNodeClient !== null && litNodeClient.ready;
}

