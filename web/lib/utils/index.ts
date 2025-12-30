/**
 * Utility Functions
 * Common helpers used across the application
 */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatUnits, parseUnits, type Address } from 'viem';
import { APP_CONFIG } from '@/lib/constants';

// ===========================================
// Tailwind Utilities
// ===========================================

/**
 * Merge Tailwind CSS classes with clsx
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ===========================================
// Token Formatting
// ===========================================

/**
 * Format token amount for display (from wei)
 */
export function formatTokenAmount(
  amount: bigint | undefined,
  decimals: number = APP_CONFIG.tokenDecimals,
  displayDecimals: number = 2
): string {
  if (!amount) return '0';
  const formatted = formatUnits(amount, decimals);
  const num = parseFloat(formatted);
  
  // Handle very small amounts
  if (num > 0 && num < 0.01) {
    return '< 0.01';
  }
  
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: displayDecimals,
  });
}

/**
 * Parse token amount from string to wei
 */
export function parseTokenAmount(
  amount: string,
  decimals: number = APP_CONFIG.tokenDecimals
): bigint {
  try {
    // Remove commas and whitespace
    const cleaned = amount.replace(/[,\s]/g, '');
    return parseUnits(cleaned, decimals);
  } catch {
    return 0n;
  }
}

/**
 * Format MNEE price for display
 */
export function formatMneePrice(priceWei: bigint): string {
  return `${formatTokenAmount(priceWei)} MNEE`;
}

// ===========================================
// Address Formatting
// ===========================================

/**
 * Truncate address for display
 */
export function truncateAddress(
  address: string | Address,
  startChars: number = 6,
  endChars: number = 4
): string {
  if (!address) return '';
  if (address.length <= startChars + endChars) return address;
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/**
 * Check if address is valid
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// ===========================================
// File Utilities
// ===========================================

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  return filename.slice(((filename.lastIndexOf('.') - 1) >>> 0) + 2).toLowerCase();
}

/**
 * Check if file type is supported for assets
 */
export function isSupportedAssetType(mimeType: string): boolean {
  return (APP_CONFIG.supportedAssetTypes as readonly string[]).includes(mimeType);
}

/**
 * Check if file type is supported for covers
 */
export function isSupportedCoverType(mimeType: string): boolean {
  return (APP_CONFIG.supportedCoverTypes as readonly string[]).includes(mimeType);
}

// ===========================================
// Time Utilities
// ===========================================

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return past.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: past.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

// ===========================================
// Async Utilities
// ===========================================

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry an async function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxAttempts) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        await sleep(delay);
      }
    }
  }
  
  throw lastError;
}

// ===========================================
// Error Handling
// ===========================================

/**
 * Extract user-friendly error message
 */
export function getErrorMessage(error: unknown): string {
  if (!error) return 'An unknown error occurred';
  
  // Handle viem/wagmi errors
  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>;
    
    // User rejected transaction
    if (err.code === 4001 || err.code === 'ACTION_REJECTED') {
      return 'Transaction was rejected';
    }
    
    // Insufficient funds
    if (err.code === -32000) {
      return 'Insufficient funds for transaction';
    }
    
    // Contract revert with reason
    if (err.shortMessage && typeof err.shortMessage === 'string') {
      return err.shortMessage;
    }
    
    // Standard error message
    if (err.message && typeof err.message === 'string') {
      // Clean up common prefixes
      let msg = err.message;
      if (msg.includes('execution reverted:')) {
        msg = msg.split('execution reverted:')[1].trim();
      }
      return msg;
    }
  }
  
  if (typeof error === 'string') return error;
  
  return 'An unknown error occurred';
}

// ===========================================
// Validation
// ===========================================

/**
 * Validate product form data
 */
export function validateProductForm(data: {
  name: string;
  description: string;
  price: string;
  coverFile: File | null;
  assetFile: File | null;
}): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  
  if (!data.name.trim()) {
    errors.name = 'Name is required';
  } else if (data.name.length > 100) {
    errors.name = 'Name must be less than 100 characters';
  }
  
  if (!data.description.trim()) {
    errors.description = 'Description is required';
  }
  
  const price = parseFloat(data.price);
  if (isNaN(price) || price <= 0) {
    errors.price = 'Price must be greater than 0';
  }
  
  if (!data.coverFile) {
    errors.cover = 'Cover image is required';
  } else if (!isSupportedCoverType(data.coverFile.type)) {
    errors.cover = 'Invalid cover image format';
  } else if (data.coverFile.size > APP_CONFIG.maxCoverSize) {
    errors.cover = `Cover image must be less than ${formatFileSize(APP_CONFIG.maxCoverSize)}`;
  }
  
  if (!data.assetFile) {
    errors.asset = 'Asset file is required';
  } else if (!isSupportedAssetType(data.assetFile.type)) {
    errors.asset = 'Unsupported file format';
  } else if (data.assetFile.size > APP_CONFIG.maxFileSize) {
    errors.asset = `File must be less than ${formatFileSize(APP_CONFIG.maxFileSize)}`;
  }
  
  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

