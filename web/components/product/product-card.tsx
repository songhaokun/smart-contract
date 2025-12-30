'use client';

/**
 * ProductCard Component
 * Displays a product in the marketplace grid
 * Supports optional seller controls for managing product status
 */

import Image from 'next/image';
import Link from 'next/link';
import { Lock, ShoppingCart, User, Power, PowerOff, Loader2 } from 'lucide-react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useMetadata } from '@/lib/hooks/use-metadata';
import { formatMneePrice, truncateAddress } from '@/lib/utils';
import { buildProxiedIpfsUrl } from '@/lib/services/pinata';
import type { Product } from '@/lib/constants/types';

interface ProductCardProps {
  product: Product;
  /** Show seller controls (activate/deactivate) */
  showSellerControls?: boolean;
  /** Callback when toggle button is clicked */
  onToggleActive?: (productId: number, newStatus: boolean) => void;
  /** Whether a toggle operation is in progress */
  isToggling?: boolean;
}

export function ProductCard({ 
  product, 
  showSellerControls = false,
  onToggleActive,
  isToggling = false,
}: ProductCardProps) {
  const { metadata, isLoading: metadataLoading } = useMetadata(product.cid);

  // Determine cover image URL - always use proxy to avoid CORS
  const coverUrl = buildProxiedIpfsUrl(product.cid, 'cover.png');

  return (
    <Link href={`/products/${product.id}`}>
      <Card className="group h-full overflow-hidden transition-all hover:shadow-lg hover:shadow-mnee-500/10 hover:border-mnee-500/30">
        {/* Cover Image */}
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          {metadataLoading ? (
            <Skeleton className="h-full w-full" />
          ) : (
            <>
              <Image
                src={coverUrl}
                alt={product.name}
                fill
                className="object-cover transition-transform group-hover:scale-105"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
              {/* Status Badge */}
              <div className="absolute top-2 right-2 flex gap-2">
                {!product.active && (
                  <Badge variant="destructive" className="gap-1">
                    <PowerOff className="h-3 w-3" />
                    Inactive
                  </Badge>
                )}
                {product.active && (
                  <Badge variant="secondary" className="gap-1 bg-black/50 backdrop-blur-sm">
                    <Lock className="h-3 w-3" />
                    Encrypted
                  </Badge>
                )}
              </div>
            </>
          )}
        </div>

        <CardContent className="p-4">
          {/* Title */}
          <h3 className="font-semibold text-lg line-clamp-1 group-hover:text-mnee-500 transition-colors">
            {product.name}
          </h3>

          {/* Description */}
          {metadataLoading ? (
            <Skeleton className="h-10 w-full mt-2" />
          ) : (
            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
              {metadata?.description || 'No description available'}
            </p>
          )}

          {/* Seller */}
          <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
            <User className="h-3 w-3" />
            <span>{truncateAddress(product.seller)}</span>
          </div>
        </CardContent>

        <CardFooter className="p-4 pt-0 flex items-center justify-between">
          {/* Price */}
          <div className="font-bold text-lg gradient-text">
            {formatMneePrice(product.price)}
          </div>

          {/* Sales Count */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <ShoppingCart className="h-3 w-3" />
            <span>{product.salesCount} sold</span>
          </div>
        </CardFooter>

        {/* Seller Controls */}
        {showSellerControls && onToggleActive && (
          <div className="px-4 pb-4 pt-0">
            <Button
              variant={product.active ? 'outline' : 'default'}
              size="sm"
              className="w-full gap-2"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleActive(product.id, !product.active);
              }}
              disabled={isToggling}
            >
              {isToggling ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : product.active ? (
                <>
                  <PowerOff className="h-4 w-4" />
                  Deactivate
                </>
              ) : (
                <>
                  <Power className="h-4 w-4" />
                  Activate
                </>
              )}
            </Button>
          </div>
        )}
      </Card>
    </Link>
  );
}

/**
 * Skeleton loader for ProductCard
 */
export function ProductCardSkeleton() {
  return (
    <Card className="h-full overflow-hidden">
      <div className="aspect-[4/3] bg-muted">
        <Skeleton className="h-full w-full" />
      </div>
      <CardContent className="p-4">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-10 w-full mt-2" />
        <Skeleton className="h-4 w-1/3 mt-3" />
      </CardContent>
      <CardFooter className="p-4 pt-0 flex justify-between">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-4 w-16" />
      </CardFooter>
    </Card>
  );
}

