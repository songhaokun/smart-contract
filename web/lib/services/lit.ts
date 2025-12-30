/**
 * Lit Protocol Service
 * Handles encryption and decryption using Lit Protocol
 * Pay-to-Decrypt functionality based on hasUserPurchased check
 * 
 * Using unifiedAccessControlConditions with conditionType: "evmContract"
 * This is the recommended approach for custom contract methods
 */

import { LIT_NETWORK, getContractAddresses, CURRENT_CHAIN } from '@/lib/constants';
import type { LitMetadata, UnifiedAccessControlCondition, OperatorCondition } from '@/lib/constants/types';

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
 * ABI for the hasUserPurchased function
 * This is required by Lit Protocol for custom contract method calls
 */
const HAS_USER_PURCHASED_ABI = {
  name: 'hasUserPurchased',
  inputs: [
    { name: '_user', type: 'address', internalType: 'address' },
    { name: '_productId', type: 'uint256', internalType: 'uint256' },
  ],
  outputs: [
    { name: '', type: 'bool', internalType: 'bool' },
  ],
  stateMutability: 'view',
  type: 'function',
};

/**
 * ABI for the products mapping (getter function)
 * Returns: (id, seller, cid, price, name, active, salesCount)
 */
const PRODUCTS_ABI = {
  name: 'products',
  inputs: [
    { name: '', type: 'uint256', internalType: 'uint256' },
  ],
  outputs: [
    { name: 'id', type: 'uint256', internalType: 'uint256' },
    { name: 'seller', type: 'address', internalType: 'address' },
    { name: 'cid', type: 'string', internalType: 'string' },
    { name: 'price', type: 'uint256', internalType: 'uint256' },
    { name: 'name', type: 'string', internalType: 'string' },
    { name: 'active', type: 'bool', internalType: 'bool' },
    { name: 'salesCount', type: 'uint256', internalType: 'uint256' },
  ],
  stateMutability: 'view',
  type: 'function',
};

// Type for unified access control conditions (including operator)
type UnifiedConditionOrOperator = UnifiedAccessControlCondition | OperatorCondition;

/**
 * Create Unified Access Control Conditions for a product
 * Uses unifiedAccessControlConditions with conditionType: "evmContract"
 * 
 * Allows decryption if:
 * 1. User has purchased the product (buyer)
 * 2. OR User is the seller of the product
 */
export function createUnifiedAccessControlConditions(
  productId: number
): UnifiedConditionOrOperator[] {
  const addresses = getContractAddresses();
  const chain = CURRENT_CHAIN === 'mainnet' ? 'ethereum' : 'sepolia';

  return [
    // Condition 1: User has purchased the product
    {
      conditionType: 'evmContract',
      contractAddress: addresses.mneeMart,
      functionName: 'hasUserPurchased',
      functionParams: [':userAddress', String(productId)],
      functionAbi: HAS_USER_PURCHASED_ABI,
      chain,
      returnValueTest: {
        key: '',
        comparator: '=',
        value: 'true',
      },
    },
    // OR operator
    { operator: 'or' },
    // Condition 2: User is the seller of the product
    {
      conditionType: 'evmContract',
      contractAddress: addresses.mneeMart,
      functionName: 'products',
      functionParams: [String(productId)],
      functionAbi: PRODUCTS_ABI,
      chain,
      returnValueTest: {
        // Key 'seller' refers to the 'seller' field in the return struct
        key: 'seller',
        comparator: '=',
        value: ':userAddress',
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

  // Create Unified Access Control Conditions (includes OR for seller access)
  const unifiedAccessControlConditions = createUnifiedAccessControlConditions(productId);
  const chain = CURRENT_CHAIN === 'mainnet' ? 'ethereum' : 'sepolia';

  console.log('Encrypting with unifiedAccessControlConditions:', JSON.stringify(unifiedAccessControlConditions, null, 2));

  // Encrypt the file using unifiedAccessControlConditions
  // Cast to any because Lit types don't include operator in their type definitions
  const { ciphertext, dataToEncryptHash } = await litEncryptFile(
    {
      unifiedAccessControlConditions: unifiedAccessControlConditions as Parameters<typeof litEncryptFile>[0]['unifiedAccessControlConditions'],
      file: fileBlob,
      chain,
    },
    client
  );

  // The ciphertext is already a Blob
  const encryptedBlob = new Blob([ciphertext], { type: 'application/octet-stream' });

  // Create Lit metadata
  const litMetadata: LitMetadata = {
    encryptedSymmetricKey: '', // Handled internally by Lit v3+
    unifiedAccessControlConditions: unifiedAccessControlConditions as LitMetadata['unifiedAccessControlConditions'],
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
  const { 
    LitAbility,
    LitAccessControlConditionResource,
    createSiweMessageWithRecaps, 
    generateAuthSig 
  } = await import('@lit-protocol/auth-helpers');

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
  // Use wildcard '*' to allow decryption of any access control condition
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

  console.log('Decrypting with unifiedAccessControlConditions:', JSON.stringify(litMetadata.unifiedAccessControlConditions, null, 2));

  // Decrypt the file using unifiedAccessControlConditions
  // Cast to any because Lit types don't include operator in their type definitions
  const decryptedData = await decryptToFile(
    {
      unifiedAccessControlConditions: litMetadata.unifiedAccessControlConditions as Parameters<typeof decryptToFile>[0]['unifiedAccessControlConditions'],
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
