'use client';

/**
 * ProductGrid Component
 * Displays a grid of product cards
 * Supports seller mode for managing products
 */

import { ProductCard, ProductCardSkeleton } from './product-card';
import type { Product } from '@/lib/constants/types';

interface ProductGridProps {
  products: Product[];
  isLoading?: boolean;
  emptyMessage?: string;
  /** Show seller controls on each card */
  showSellerControls?: boolean;
  /** Callback when product status is toggled */
  onToggleActive?: (productId: number, newStatus: boolean) => void;
  /** Product ID currently being toggled */
  togglingProductId?: number | null;
}

export function ProductGrid({ 
  products, 
  isLoading, 
  emptyMessage = 'No products found',
  showSellerControls = false,
  onToggleActive,
  togglingProductId,
}: ProductGridProps) {
  // Loading state
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  // Empty state
  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-muted p-6 mb-4">
          <svg
            className="h-12 w-12 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold">{emptyMessage}</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Check back later for new products
        </p>
      </div>
    );
  }

  // Products grid
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <ProductCard 
          key={product.id} 
          product={product}
          showSellerControls={showSellerControls}
          onToggleActive={onToggleActive}
          isToggling={togglingProductId === product.id}
        />
      ))}
    </div>
  );
}

