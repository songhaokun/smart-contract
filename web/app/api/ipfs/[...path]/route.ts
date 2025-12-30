/**
 * IPFS Proxy Route Handler
 * 
 * Proxies IPFS requests through the server to avoid CORS issues
 * with public Pinata gateways.
 * 
 * Usage: /api/ipfs/{cid}/metadata.json
 *        /api/ipfs/{cid}/cover.png
 */

import { NextRequest, NextResponse } from 'next/server';

// Cache for IPFS content (in-memory, resets on server restart)
const cache = new Map<string, { data: ArrayBuffer; contentType: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Rate limiting
const requestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 30; // requests per minute
const RATE_WINDOW = 60 * 1000; // 1 minute

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = requestCounts.get(ip);
  
  if (!record || now > record.resetTime) {
    requestCounts.set(ip, { count: 1, resetTime: now + RATE_WINDOW });
    return false;
  }
  
  if (record.count >= RATE_LIMIT) {
    return true;
  }
  
  record.count++;
  return false;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    
    // Get client IP for rate limiting
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown';
    
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }
    
    // Build the path from segments
    const ipfsPath = path.join('/');
    
    if (!ipfsPath) {
      return NextResponse.json(
        { error: 'Path is required' },
        { status: 400 }
      );
    }
    
    // Check cache first
    const cacheKey = ipfsPath;
    const cached = cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return new NextResponse(cached.data, {
        status: 200,
        headers: {
          'Content-Type': cached.contentType,
          'Cache-Control': 'public, max-age=300',
          'X-Cache': 'HIT',
        },
      });
    }
    
    // Fetch from Pinata gateway
    const gateway = process.env.PINATA_GATEWAY || 'https://gateway.pinata.cloud';
    const url = `${gateway}/ipfs/${ipfsPath}`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': '*/*',
      },
      // Add timeout
      signal: AbortSignal.timeout(30000),
    });
    
    if (!response.ok) {
      // If Pinata returns 429, try alternative gateways
      if (response.status === 429) {
        const alternativeGateways = [
          'https://ipfs.io',
          'https://cloudflare-ipfs.com',
          'https://dweb.link',
        ];
        
        for (const altGateway of alternativeGateways) {
          try {
            const altUrl = `${altGateway}/ipfs/${ipfsPath}`;
            const altResponse = await fetch(altUrl, {
              signal: AbortSignal.timeout(15000),
            });
            
            if (altResponse.ok) {
              const data = await altResponse.arrayBuffer();
              const contentType = altResponse.headers.get('content-type') || 'application/octet-stream';
              
              // Cache the result
              cache.set(cacheKey, { data, contentType, timestamp: Date.now() });
              
              return new NextResponse(data, {
                status: 200,
                headers: {
                  'Content-Type': contentType,
                  'Cache-Control': 'public, max-age=300',
                  'X-Gateway': altGateway,
                },
              });
            }
          } catch {
            // Try next gateway
            continue;
          }
        }
      }
      
      return NextResponse.json(
        { error: `Failed to fetch: ${response.status}` },
        { status: response.status }
      );
    }
    
    const data = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    
    // Cache the result
    cache.set(cacheKey, { data, contentType, timestamp: Date.now() });
    
    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=300',
        'X-Cache': 'MISS',
      },
    });
    
  } catch (error) {
    console.error('IPFS proxy error:', error);
    
    if (error instanceof Error && error.name === 'TimeoutError') {
      return NextResponse.json(
        { error: 'Request timeout' },
        { status: 504 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
