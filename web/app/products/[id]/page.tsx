'use client';

/**
 * Product Detail Page
 * Shows product details and handles purchase/decrypt flow
 */

import { useParams } from 'next/navigation';
import { useAccount } from 'wagmi';
import Image from 'next/image';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Download, 
  Lock, 
  Unlock, 
  ShoppingCart, 
  User, 
  ExternalLink,
  Check,
  Loader2
} from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';

import { useProduct, useHasPurchased } from '@/lib/hooks/use-products';
import { useMetadata } from '@/lib/hooks/use-metadata';
import { usePurchase } from '@/lib/hooks/use-purchase';
import { formatMneePrice, truncateAddress, formatFileSize } from '@/lib/utils';
import { buildProxiedIpfsUrl, fetchEncryptedAsset } from '@/lib/services/pinata';
import { decryptFile } from '@/lib/services/lit';
import { buildEtherscanUrl } from '@/lib/constants';
import type { DecryptState } from '@/lib/constants/types';

export default function ProductDetailPage() {
  const params = useParams();
  const productId = Number(params.id);
  const { address, isConnected } = useAccount();
  const { toast } = useToast();

  // Fetch product data
  const { product, isLoading: productLoading, error: productError } = useProduct(productId);
  const { metadata, isLoading: metadataLoading } = useMetadata(product?.cid);
  const { data: hasPurchased, isLoading: purchaseCheckLoading } = useHasPurchased(address, productId);

  // Purchase flow
  const purchase = usePurchase({
    productId,
    price: product?.price || 0n,
    onSuccess: () => {
      toast({
        title: 'Purchase successful!',
        description: 'You can now decrypt and download the file.',
        variant: 'success',
      });
    },
    onError: (error) => {
      toast({
        title: 'Purchase failed',
        description: error,
        variant: 'destructive',
      });
    },
  });

  // Decrypt state
  const [decryptState, setDecryptState] = useState<DecryptState>('idle');
  const [decryptError, setDecryptError] = useState<string | null>(null);

  // Check if user is the seller
  const isSeller = address && product?.seller.toLowerCase() === address.toLowerCase();
  const canAccess = hasPurchased || isSeller;

  // Cover image URL - always use proxy to avoid CORS
  const coverUrl = product?.cid ? buildProxiedIpfsUrl(product.cid, 'cover.png') : '';

  // Handle decrypt and download
  const handleDecrypt = async () => {
    if (!product || !metadata?.lit) return;

    try {
      setDecryptState('connecting_lit');
      setDecryptError(null);

      // Get signer from wallet
      const { getWalletClient } = await import('wagmi/actions');
      const { wagmiConfig } = await import('@/lib/wagmi');
      const walletClient = await getWalletClient(wagmiConfig);
      
      if (!walletClient) {
        throw new Error('No wallet connected');
      }

      const signer = {
        getAddress: async () => walletClient.account.address,
        signMessage: async (message: string) => {
          return walletClient.signMessage({ message });
        },
      };

      setDecryptState('decrypting');

      // Fetch encrypted asset
      const encryptedBlob = await fetchEncryptedAsset(product.cid);

      // Decrypt
      const decryptedBlob = await decryptFile(encryptedBlob, metadata.lit, signer);

      setDecryptState('downloading');

      // Trigger download
      const url = URL.createObjectURL(decryptedBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = metadata.originalFileName || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setDecryptState('success');
      toast({
        title: 'Download started!',
        description: 'Your file is being downloaded.',
        variant: 'success',
      });

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Decryption failed';
      setDecryptError(message);
      setDecryptState('error');
      toast({
        title: 'Decryption failed',
        description: message,
        variant: 'destructive',
      });
    }
  };

  // Loading state
  if (productLoading) {
    return (
      <div className="container py-8">
        <div className="grid gap-8 lg:grid-cols-2">
          <Skeleton className="aspect-square rounded-lg" />
          <div className="space-y-4">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </div>
    );
  }

  // Error or not found
  if (productError || !product) {
    return (
      <div className="container py-16 text-center">
        <h1 className="text-2xl font-bold">Product not found</h1>
        <p className="text-muted-foreground mt-2">
          This product may have been removed or doesn&apos;t exist.
        </p>
        <Link href="/">
          <Button variant="outline" className="mt-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Marketplace
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container py-8">
      {/* Back Button */}
      <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Marketplace
      </Link>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Cover Image */}
        <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
          {coverUrl && (
            <Image
              src={coverUrl}
              alt={product.name}
              fill
              className="object-cover"
              priority
            />
          )}
          <div className="absolute top-4 right-4">
            <Badge variant="secondary" className="gap-1 bg-black/50 backdrop-blur-sm text-white">
              {canAccess ? (
                <>
                  <Unlock className="h-3 w-3" />
                  Unlocked
                </>
              ) : (
                <>
                  <Lock className="h-3 w-3" />
                  Encrypted
                </>
              )}
            </Badge>
          </div>
        </div>

        {/* Product Info */}
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">{product.name}</h1>
            {metadata?.title && metadata.title !== product.name && (
              <p className="text-lg text-muted-foreground">{metadata.title}</p>
            )}
          </div>

          {/* Price */}
          <div className="text-4xl font-bold gradient-text">
            {formatMneePrice(product.price)}
          </div>

          {/* Seller & Stats */}
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="h-4 w-4" />
              <span>Seller:</span>
              <a
                href={buildEtherscanUrl('address', product.seller)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground hover:text-mnee-500 flex items-center gap-1"
              >
                {truncateAddress(product.seller)}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <ShoppingCart className="h-4 w-4" />
              <span>{product.salesCount} sales</span>
            </div>
          </div>

          {/* Description */}
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold mb-2">Description</h3>
              {metadataLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : (
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {metadata?.description || 'No description available'}
                </p>
              )}
            </CardContent>
          </Card>

          {/* File Info */}
          {metadata && (
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-2">File Info</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-muted-foreground">Type:</div>
                  <div>{metadata.mimeType}</div>
                  <div className="text-muted-foreground">Size:</div>
                  <div>{formatFileSize(metadata.sizeBytes)}</div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Button */}
          <div className="pt-4">
            {!isConnected ? (
              <Button size="lg" variant="gradient" className="w-full" disabled>
                Connect Wallet to Purchase
              </Button>
            ) : purchaseCheckLoading ? (
              <Button size="lg" variant="outline" className="w-full" disabled>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Checking...
              </Button>
            ) : canAccess ? (
              <Button
                size="lg"
                variant="gradient"
                className="w-full gap-2"
                onClick={handleDecrypt}
                disabled={decryptState !== 'idle' && decryptState !== 'success' && decryptState !== 'error'}
              >
                {decryptState === 'connecting_lit' && (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Connecting to Lit...
                  </>
                )}
                {decryptState === 'decrypting' && (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Decrypting...
                  </>
                )}
                {decryptState === 'downloading' && (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Downloading...
                  </>
                )}
                {decryptState === 'success' && (
                  <>
                    <Check className="h-4 w-4" />
                    Download Again
                  </>
                )}
                {(decryptState === 'idle' || decryptState === 'error') && (
                  <>
                    <Download className="h-4 w-4" />
                    Decrypt & Download
                  </>
                )}
              </Button>
            ) : isSeller ? (
              <Button size="lg" variant="outline" className="w-full" disabled>
                You own this product
              </Button>
            ) : purchase.needsApproval ? (
              <Button
                size="lg"
                variant="gradient"
                className="w-full gap-2"
                onClick={purchase.handleApprove}
                loading={purchase.isLoading}
              >
                Approve MNEE
              </Button>
            ) : (
              <Button
                size="lg"
                variant="gradient"
                className="w-full gap-2"
                onClick={purchase.handlePurchase}
                loading={purchase.isLoading}
                disabled={purchase.hasInsufficientBalance}
              >
                {purchase.hasInsufficientBalance ? (
                  'Insufficient MNEE Balance'
                ) : (
                  <>
                    <ShoppingCart className="h-4 w-4" />
                    Buy Now
                  </>
                )}
              </Button>
            )}

            {/* Error Message */}
            {(purchase.error || decryptError) && (
              <p className="text-destructive text-sm mt-2 text-center">
                {purchase.error || decryptError}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

