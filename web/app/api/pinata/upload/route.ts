/**
 * Pinata Upload Route Handler
 * 
 * Server-side upload to Pinata IPFS.
 * This keeps the PINATA_JWT secret on the server.
 */

import { NextRequest, NextResponse } from 'next/server';
import { PinataSDK } from 'pinata';

// Initialize Pinata SDK
function getPinataClient() {
  const jwt = process.env.PINATA_JWT;
  const gateway = process.env.PINATA_GATEWAY || 'gateway.pinata.cloud';
  
  if (!jwt) {
    throw new Error('PINATA_JWT not configured');
  }
  
  return new PinataSDK({
    pinataJwt: jwt,
    pinataGateway: gateway.replace('https://', '').replace('http://', ''),
  });
}

export async function POST(request: NextRequest) {
  try {
    const pinata = getPinataClient();
    
    // Parse multipart form data
    const formData = await request.formData();
    
    // Get files from form data
    const coverFile = formData.get('cover') as File | null;
    const assetFile = formData.get('asset') as File | null;
    const metadataString = formData.get('metadata') as string | null;
    
    if (!coverFile || !assetFile || !metadataString) {
      return NextResponse.json(
        { error: 'Missing required files: cover, asset, and metadata' },
        { status: 400 }
      );
    }

    // Parse metadata
    let metadata: Record<string, unknown>;
    try {
      metadata = JSON.parse(metadataString);
    } catch {
      return NextResponse.json(
        { error: 'Invalid metadata JSON' },
        { status: 400 }
      );
    }

    // Get cover extension
    const coverExt = coverFile.name.split('.').pop() || 'png';

    // Create files array for directory upload
    const files = [
      new File([coverFile], `cover.${coverExt}`, { type: coverFile.type }),
      new File([assetFile], 'asset.enc', { type: 'application/octet-stream' }),
      new File(
        [JSON.stringify(metadata, null, 2)], 
        'metadata.json', 
        { type: 'application/json' }
      ),
    ];

    // Upload as directory to Pinata
    const upload = await pinata.upload.public.fileArray(files);

    return NextResponse.json({
      success: true,
      cid: upload.cid,
      id: upload.id,
    });

  } catch (error) {
    console.error('Pinata upload error:', error);
    
    const message = error instanceof Error ? error.message : 'Upload failed';
    
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

// Route Segment Config for App Router
// Note: In App Router, formData() handles multipart automatically
// No need for bodyParser config like in Pages Router
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

