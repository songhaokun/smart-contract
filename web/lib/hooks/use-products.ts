'use client';

/**
 * useProducts Hook
 * Fetches and manages product data from the contract
 */

import { useReadContract, useReadContracts } from 'wagmi';
import { useMemo } from 'react';
import { mneeMartConfig } from '@/lib/contracts';
import type { Product, ContractProduct } from '@/lib/constants/types';

/**
 * Hook to get the total number of products
 */
export function useProductCounter() {
  return useReadContract({
    ...mneeMartConfig,
    functionName: 'productCounter',
  });
}

/**
 * Hook to get a single product by ID
 */
export function useProduct(productId: number) {
  const { data, isLoading, error, refetch } = useReadContract({
    ...mneeMartConfig,
    functionName: 'products',
    args: [BigInt(productId)],
    query: {
      enabled: productId > 0,
    },
  });

  const product = useMemo(() => {
    if (!data) return null;
    
    const [id, seller, cid, price, name, active, salesCount] = data as [
      bigint, string, string, bigint, string, boolean, bigint
    ];

    // Product doesn't exist if ID is 0
    if (id === 0n) return null;

    return {
      id: Number(id),
      seller: seller as `0x${string}`,
      cid,
      price,
      name,
      active,
      salesCount: Number(salesCount),
    } as Product;
  }, [data]);

  return { product, isLoading, error, refetch };
}

/**
 * Hook to get multiple products by ID range
 */
export function useProducts(startId: number, endId: number) {
  // Create contract calls for each product
  const contracts = useMemo(() => {
    if (startId > endId || startId < 1) return [];
    
    return Array.from({ length: endId - startId + 1 }, (_, i) => ({
      ...mneeMartConfig,
      functionName: 'products' as const,
      args: [BigInt(startId + i)] as const,
    }));
  }, [startId, endId]);

  const { data, isLoading, error, refetch } = useReadContracts({
    contracts,
    query: {
      enabled: contracts.length > 0,
    },
  });

  const products = useMemo(() => {
    if (!data) return [];

    return data
      .map((result, index) => {
        if (result.status !== 'success' || !result.result) return null;

        const [id, seller, cid, price, name, active, salesCount] = result.result as [
          bigint, string, string, bigint, string, boolean, bigint
        ];

        // Skip non-existent products
        if (id === 0n) return null;

        return {
          id: Number(id),
          seller: seller as `0x${string}`,
          cid,
          price,
          name,
          active,
          salesCount: Number(salesCount),
        } as Product;
      })
      .filter((p): p is Product => p !== null);
  }, [data]);

  return { products, isLoading, error, refetch };
}

/**
 * Hook to get all active products
 * Uses productCounter to determine range
 */
export function useAllProducts() {
  const { data: counter, isLoading: counterLoading } = useProductCounter();
  
  const productCount = counter ? Number(counter) : 0;
  
  const { products, isLoading: productsLoading, error, refetch } = useProducts(
    1,
    productCount
  );

  // Filter only active products
  const activeProducts = useMemo(() => {
    return products.filter((p) => p.active);
  }, [products]);

  return {
    products: activeProducts,
    allProducts: products,
    isLoading: counterLoading || productsLoading,
    error,
    refetch,
    totalCount: productCount,
  };
}

/**
 * Hook to check if user has purchased a product
 */
export function useHasPurchased(userAddress: string | undefined, productId: number) {
  return useReadContract({
    ...mneeMartConfig,
    functionName: 'hasUserPurchased',
    args: userAddress ? [userAddress as `0x${string}`, BigInt(productId)] : undefined,
    query: {
      enabled: !!userAddress && productId > 0,
    },
  });
}

/**
 * Hook to get seller's products
 */
export function useSellerProducts(sellerAddress: string | undefined) {
  const { data: productIds, isLoading: idsLoading, error: idsError } = useReadContract({
    ...mneeMartConfig,
    functionName: 'getSellerProducts',
    args: sellerAddress ? [sellerAddress as `0x${string}`] : undefined,
    query: {
      enabled: !!sellerAddress,
    },
  });

  // Create contract calls for each product
  const contracts = useMemo(() => {
    if (!productIds) return [];
    
    return (productIds as bigint[]).map((id) => ({
      ...mneeMartConfig,
      functionName: 'products' as const,
      args: [id] as const,
    }));
  }, [productIds]);

  const { data: productsData, isLoading: productsLoading, refetch: refetchProducts } = useReadContracts({
    contracts,
    query: {
      enabled: contracts.length > 0,
    },
  });

  const products = useMemo(() => {
    if (!productsData) return [];

    return productsData
      .map((result) => {
        if (result.status !== 'success' || !result.result) return null;

        const [id, seller, cid, price, name, active, salesCount] = result.result as [
          bigint, string, string, bigint, string, boolean, bigint
        ];

        if (id === 0n) return null;

        return {
          id: Number(id),
          seller: seller as `0x${string}`,
          cid,
          price,
          name,
          active,
          salesCount: Number(salesCount),
        } as Product;
      })
      .filter((p): p is Product => p !== null);
  }, [productsData]);

  // Combined refetch function
  const refetch = async () => {
    await refetchProducts();
  };

  return {
    products,
    isLoading: idsLoading || productsLoading,
    error: idsError,
    refetch,
  };
}

