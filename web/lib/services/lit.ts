/**
 * Lit Protocol Service
 * Handles encryption and decryption using Lit Protocol
 * Pay-to-Decrypt functionality based on hasUserPurchased OR seller check
 * 
 * Using unifiedAccessControlConditions with conditionType: "evmContract"
 * This is the recommended approach for custom contract methods
 * 
 * IMPORTANT: When Hema adds canAccessProduct function, we should use that instead
 * of the products tuple field check for more reliable decryption.
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
    debug: true, // Always enable debug for troubleshooting
  });

  await litNodeClient.connect();
  console.log('[Lit] Connected to Lit Network:', LIT_NETWORK);
  
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
  constant: true, // Added for Lit Protocol compatibility
};

/**
 * ABI for canAccessProduct function (preferred method)
 * Returns true if user is seller OR has purchased
 * NOTE: Requires Hema to add this function to the contract
 */
const CAN_ACCESS_PRODUCT_ABI = {
  name: 'canAccessProduct',
  inputs: [
    { name: '_user', type: 'address', internalType: 'address' },
    { name: '_productId', type: 'uint256', internalType: 'uint256' },
  ],
  outputs: [
    { name: '', type: 'bool', internalType: 'bool' },
  ],
  stateMutability: 'view',
  type: 'function',
  constant: true,
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
  constant: true, // Added for Lit Protocol compatibility
};

// Type for unified access control conditions (including operator)
type UnifiedConditionOrOperator = UnifiedAccessControlCondition | OperatorCondition;

// Flag to indicate if canAccessProduct is available in the contract
// Set to true once Hema adds the function
const USE_CAN_ACCESS_PRODUCT = false;

/**
 * Create Unified Access Control Conditions for a product
 * Uses unifiedAccessControlConditions with conditionType: "evmContract"
 * 
 * Allows decryption if:
 * 1. User has purchased the product (buyer)
 * 2. OR User is the seller of the product
 * 
 * When canAccessProduct is available, uses single condition for simplicity
 */
export function createUnifiedAccessControlConditions(
  productId: number
): UnifiedConditionOrOperator[] {
  const addresses = getContractAddresses();
  const chain = CURRENT_CHAIN === 'mainnet' ? 'ethereum' : 'sepolia';

  console.log('[Lit] Creating access conditions for product:', productId);
  console.log('[Lit] Contract address:', addresses.mneeMart);
  console.log('[Lit] Chain:', chain);

  // If canAccessProduct is available, use it (simpler and more reliable)
  if (USE_CAN_ACCESS_PRODUCT) {
    console.log('[Lit] Using canAccessProduct function');
    return [
      {
        conditionType: 'evmContract',
        contractAddress: addresses.mneeMart,
        functionName: 'canAccessProduct',
        functionParams: [':userAddress', String(productId)],
        functionAbi: CAN_ACCESS_PRODUCT_ABI,
        chain,
        returnValueTest: {
          key: '',
          comparator: '=',
          value: 'true',
        },
      },
    ];
  }

  // Fallback: Use OR condition with hasUserPurchased and products.seller check
  console.log('[Lit] Using OR condition (hasUserPurchased OR seller check)');
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

  // ciphertext from Lit is a base64 encoded string
  // We store it as a text blob (will be read as text during decryption)
  const encryptedBlob = new Blob([ciphertext], { type: 'text/plain' });

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
 * User must have purchased the product OR be the seller
 */
export async function decryptFile(
  encryptedBlob: Blob,
  litMetadata: LitMetadata,
  signer: {
    getAddress: () => Promise<string>;
    signMessage: (message: string) => Promise<string>;
  }
): Promise<Blob> {
  console.log('[Lit] Starting decryption...');
  
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

  console.log('[Lit] Wallet address:', walletAddress);
  console.log('[Lit] Chain:', chain);
  console.log('[Lit] Access conditions:', JSON.stringify(litMetadata.unifiedAccessControlConditions, null, 2));

  // Check if the conditions contain an old contract address
  const currentAddress = getContractAddresses().mneeMart.toLowerCase();
  const conditionsStr = JSON.stringify(litMetadata.unifiedAccessControlConditions);
  if (!conditionsStr.toLowerCase().includes(currentAddress)) {
    console.warn('[Lit] WARNING: Access conditions contain a different contract address than current config!');
    console.warn('[Lit] This is expected for products created before contract upgrade.');
    console.warn('[Lit] Current contract:', currentAddress);
  }

  // Get latest blockhash for session signature
  const latestBlockhash = await client.getLatestBlockhash();
  console.log('[Lit] Got blockhash:', latestBlockhash.substring(0, 20) + '...');

  // Create auth callback
  const authNeededCallback = async (params: {
    uri?: string;
    expiration?: string;
    resourceAbilityRequests?: Array<{ resource: { getResourceKey: () => string }; ability: string }>;
  }) => {
    console.log('[Lit] Auth callback triggered');
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

    console.log('[Lit] Signing message...');
    const authSig = await generateAuthSig({
      signer: {
        getAddress: async () => walletAddress,
        signMessage: async (message: string) => signer.signMessage(message),
      } as Parameters<typeof generateAuthSig>[0]['signer'],
      toSign,
    });

    console.log('[Lit] Auth signature generated');
    return authSig;
  };

  // Create resource for decryption
  // Use wildcard '*' to allow decryption of any access control condition
  const litResource = new LitAccessControlConditionResource('*');

  try {
    // Get session signatures
    console.log('[Lit] Getting session signatures...');
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
    console.log('[Lit] Session signatures obtained');

    // The encrypted blob contains the ciphertext string (already base64 encoded by Lit)
    // We need to read it as TEXT, not convert to base64 again (that would cause double encoding)
    const ciphertext = await encryptedBlob.text();
    
    console.log('[Lit] Decrypting file (ciphertext length: %d chars)...', ciphertext.length);

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

    console.log('[Lit] Decryption successful!');

    // Convert Uint8Array to Blob - copy to new ArrayBuffer to ensure correct type
    const outputBuffer = new ArrayBuffer(decryptedData.byteLength);
    new Uint8Array(outputBuffer).set(decryptedData);
    return new Blob([outputBuffer]);
  } catch (error) {
    console.error('[Lit] Decryption failed:', error);
    
    // Provide more helpful error messages
    if (error instanceof Error) {
      const errorMsg = error.message.toLowerCase();
      
      if (errorMsg.includes('access control') || errorMsg.includes('condition')) {
        console.error('[Lit] This is likely an access control condition failure.');
        console.error('[Lit] Possible causes:');
        console.error('[Lit] 1. User has not purchased the product');
        console.error('[Lit] 2. User is not the seller of the product');
        console.error('[Lit] 3. The contract does not support the required functions');
        console.error('[Lit] 4. Lit Protocol cannot verify tuple return values correctly');
        console.error('[Lit] Solution: Ask Hema to add canAccessProduct(address, uint256) returns (bool) function');
      }
      
      if (errorMsg.includes('network') || errorMsg.includes('rpc')) {
        console.error('[Lit] This may be a network or RPC issue. Please try again.');
      }
    }
    
    throw error;
  }
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
