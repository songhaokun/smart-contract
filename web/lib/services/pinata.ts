/**
 * Pinata Service
 * Handles IPFS uploads via server-side Pinata API
 * 
 * Files are uploaded through our API route which uses the Pinata SDK
 * to keep the JWT secret on the server.
 * 
 * IMPORTANT: All reads go through our IPFS proxy (/api/ipfs/) to avoid CORS issues.
 */

import type { ProductMetadata, UploadResponse } from '@/lib/constants/types';

/**
 * Build a proxied IPFS URL
 * Uses our server-side proxy to avoid CORS issues with public gateways
 */
export function buildProxiedIpfsUrl(cid: string, path?: string): string {
  const basePath = `/api/ipfs/${cid}`;
  return path ? `${basePath}/${path}` : basePath;
}

/**
 * Upload a product directory to Pinata via server-side API
 * Creates: /metadata.json, /cover.{ext}, /asset.enc
 * 
 * @returns The root CID of the uploaded directory
 */
export async function uploadProductDirectory(
  coverFile: File,
  encryptedAsset: Blob,
  metadata: ProductMetadata,
  options?: {
    onProgress?: (stage: string, progress: number) => void;
  }
): Promise<string> {
  const { onProgress } = options || {};

  onProgress?.('preparing', 10);

  // Create form data for server upload
  const formData = new FormData();
  formData.append('cover', coverFile);
  formData.append('asset', new File([encryptedAsset], 'asset.enc', { 
    type: 'application/octet-stream' 
  }));
  formData.append('metadata', JSON.stringify(metadata));

  onProgress?.('uploading', 30);

  // Upload via server-side API route
  const response = await fetch('/api/pinata/upload', {
    method: 'POST',
    body: formData,
  });

  onProgress?.('processing', 70);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(error.error || 'Failed to upload to IPFS');
  }

  const result = await response.json();
  
  onProgress?.('complete', 100);

  return result.cid;
}

/**
 * Upload a single file to Pinata
 */
export async function uploadFile(
  file: File | Blob,
  fileName: string,
  options?: {
    onProgress?: (progress: number) => void;
  }
): Promise<UploadResponse> {
  const formData = new FormData();
  
  // Create minimal metadata for single file upload
  const metadata = {
    name: fileName,
    type: 'single-file',
  };
  
  formData.append('cover', new File([file], fileName));
  formData.append('asset', new File([new Blob()], 'empty.enc'));
  formData.append('metadata', JSON.stringify(metadata));

  const response = await fetch('/api/pinata/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(error.error || 'Upload failed');
  }

  const result = await response.json();
  
  return {
    cid: result.cid,
    size: 0, // Size not returned by new API
  };
}

/**
 * Fetch metadata from IPFS via our proxy
 * This avoids CORS issues with public gateways
 */
export async function fetchMetadata(cid: string): Promise<ProductMetadata> {
  // Use our proxy to avoid CORS issues
  const url = buildProxiedIpfsUrl(cid, 'metadata.json');
  
  const response = await fetch(url, {
    // No need for revalidate in client-side fetch
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch metadata: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch encrypted asset from IPFS via our proxy
 */
export async function fetchEncryptedAsset(cid: string): Promise<Blob> {
  const url = buildProxiedIpfsUrl(cid, 'asset.enc');
  
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch asset: ${response.status}`);
  }

  return response.blob();
}

/**
 * Get cover image URL (proxied)
 * For use with next/image or img tags
 */
export function getCoverUrl(cid: string, extension: string = 'png'): string {
  return buildProxiedIpfsUrl(cid, `cover.${extension}`);
}

/**
 * Get metadata URL (proxied)
 */
export function getMetadataUrl(cid: string): string {
  return buildProxiedIpfsUrl(cid, 'metadata.json');
}

/**
 * Check if a CID is pinned (exists on IPFS)
 */
export async function isPinned(cid: string): Promise<boolean> {
  try {
    const response = await fetch(buildProxiedIpfsUrl(cid, 'metadata.json'), {
      method: 'HEAD',
    });
    return response.ok;
  } catch {
    return false;
  }
}
