/**
 * Type Definitions
 * Shared types across the application
 */

import type { Address } from 'viem';

// ===========================================
// Contract Types (mirrors Solidity structs)
// ===========================================

/**
 * Product from smart contract
 */
export interface ContractProduct {
  id: bigint;
  seller: Address;
  cid: string;
  price: bigint;
  name: string;
  active: boolean;
  salesCount: bigint;
}

/**
 * Seller from smart contract
 */
export interface ContractSeller {
  productIds: bigint[];
  totalSales: bigint;
  balance: bigint;
  totalEarnings: bigint;
}

// ===========================================
// IPFS / Metadata Types
// ===========================================

/**
 * Lit Protocol encryption metadata
 */
export interface LitMetadata {
  /** Encrypted symmetric key (base64) - deprecated in Lit v3+ */
  encryptedSymmetricKey: string;
  /** Unified Access Control conditions for decryption */
  unifiedAccessControlConditions: UnifiedAccessControlCondition[];
  /** Chain for access control */
  chain: string;
  /** Data hash for verification */
  dataToEncryptHash: string;
}

/**
 * Unified Access Control Condition with conditionType
 * This is the correct format for custom contract methods in Lit Protocol
 * Using unifiedAccessControlConditions with conditionType: "evmContract"
 */
export interface UnifiedAccessControlCondition {
  conditionType: 'evmContract';
  contractAddress: string;
  functionName: string;
  functionParams: string[];
  functionAbi: {
    name: string;
    inputs: Array<{ name: string; type: string; internalType?: string }>;
    outputs: Array<{ name: string; type: string; internalType?: string }>;
    stateMutability: string;
    type: string;
  };
  chain: string;
  returnValueTest: {
    key: string;
    comparator: string;
    value: string;
  };
}

/**
 * Product metadata stored on IPFS
 * Follows RootCID directory structure
 */
export interface ProductMetadata {
  /** Schema version */
  schema: 'meneemart.v1';
  /** Full title */
  title: string;
  /** Short name (matches contract name) */
  shortName: string;
  /** Full description */
  description: string;
  /** Cover image path (ipfs://<RootCID>/cover.png) */
  cover: string;
  /** Encrypted asset path (ipfs://<RootCID>/asset.enc) */
  encryptedAsset: string;
  /** Original file MIME type */
  mimeType: string;
  /** Original file size in bytes */
  sizeBytes: number;
  /** Original file name */
  originalFileName?: string;
  /** Lit Protocol encryption data */
  lit: LitMetadata;
  /** Creation timestamp */
  createdAt: string;
}

// ===========================================
// Application Types
// ===========================================

/**
 * Product with enriched data (contract + metadata)
 */
export interface Product {
  /** Product ID from contract */
  id: number;
  /** Seller address */
  seller: Address;
  /** IPFS RootCID */
  cid: string;
  /** Price in MNEE (wei) */
  price: bigint;
  /** Short name from contract */
  name: string;
  /** Is product active */
  active: boolean;
  /** Number of sales */
  salesCount: number;
  /** Metadata from IPFS (if loaded) */
  metadata?: ProductMetadata;
  /** Whether current user has purchased */
  hasPurchased?: boolean;
  /** Is metadata loading */
  isLoadingMetadata?: boolean;
  /** Metadata load error */
  metadataError?: string;
}

/**
 * Purchase state machine states
 */
export type PurchaseState = 
  | 'idle'
  | 'checking_allowance'
  | 'approving'
  | 'waiting_approval'
  | 'purchasing'
  | 'waiting_purchase'
  | 'success'
  | 'error';

/**
 * Decrypt state machine states
 */
export type DecryptState =
  | 'idle'
  | 'connecting_lit'
  | 'getting_session'
  | 'decrypting'
  | 'downloading'
  | 'success'
  | 'error';

/**
 * Upload state machine states
 */
export type UploadState =
  | 'idle'
  | 'encrypting'
  | 'uploading_asset'
  | 'uploading_cover'
  | 'uploading_metadata'
  | 'listing'
  | 'waiting_tx'
  | 'success'
  | 'error';

/**
 * Form data for creating a product
 */
export interface CreateProductForm {
  name: string;
  description: string;
  price: string;
  coverFile: File | null;
  assetFile: File | null;
}

/**
 * Toast notification types
 */
export interface ToastData {
  id: string;
  type: 'success' | 'error' | 'info' | 'loading';
  title: string;
  description?: string;
  duration?: number;
}

// ===========================================
// API Response Types
// ===========================================

/**
 * Upload response from Pinata
 */
export interface UploadResponse {
  cid: string;
  size: number;
}

// ===========================================
// Utility Types
// ===========================================

/**
 * Async operation result
 */
export type AsyncResult<T> = 
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: string };

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

