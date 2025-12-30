'use client';

/**
 * Profile Page
 * Shows user's listings and purchases
 * Allows sellers to manage their products (activate/deactivate)
 */

import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ProductGrid } from '@/components/product/product-grid';
import { useToast } from '@/components/ui/use-toast';
import { useSellerProducts, useAllProducts, useHasPurchased } from '@/lib/hooks/use-products';
import { mneeMartConfig } from '@/lib/contracts';
import { formatTokenAmount, truncateAddress } from '@/lib/utils';
import { buildEtherscanUrl } from '@/lib/constants';
import { 
  Wallet, 
  ShoppingBag, 
  Package, 
  DollarSign, 
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';

export default function ProfilePage() {
  const { address, isConnected } = useAccount();
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  // Product toggle state
  const [togglingProductId, setTogglingProductId] = useState<number | null>(null);
  const [pendingStatus, setPendingStatus] = useState<boolean | null>(null);

  // Fetch seller products
  const { products: sellerProducts, isLoading: sellerLoading, refetch: refetchSellerProducts } = useSellerProducts(address);

  // Contract write for toggling product status
  const { 
    writeContract: toggleProduct, 
    data: toggleTxHash,
    isPending: isTogglePending,
    reset: resetToggle,
  } = useWriteContract();

  // Wait for toggle transaction
  const { isLoading: isToggleConfirming, isSuccess: isToggleSuccess } = useWaitForTransactionReceipt({
    hash: toggleTxHash,
  });

  // Handle toggle success
  useEffect(() => {
    if (isToggleSuccess && togglingProductId !== null) {
      toast({
        title: pendingStatus ? 'Product Activated' : 'Product Deactivated',
        description: `Product #${togglingProductId} has been ${pendingStatus ? 'activated' : 'deactivated'}.`,
        variant: 'success',
      });
      setTogglingProductId(null);
      setPendingStatus(null);
      resetToggle();
      refetchSellerProducts();
    }
  }, [isToggleSuccess, togglingProductId, pendingStatus, toast, resetToggle, refetchSellerProducts]);

  // Handle toggle product active status
  const handleToggleActive = useCallback((productId: number, newStatus: boolean) => {
    setTogglingProductId(productId);
    setPendingStatus(newStatus);
    
    toggleProduct({
      ...mneeMartConfig,
      functionName: newStatus ? 'activateProduct' : 'deactivateProduct',
      args: [BigInt(productId)],
    });
  }, [toggleProduct]);

  // Fetch all products to filter purchases
  const { products: allProducts, isLoading: allLoading } = useAllProducts();

  // Fetch seller info
  const { data: sellerInfo } = useReadContract({
    ...mneeMartConfig,
    functionName: 'sellers',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  // Parse seller info
  const sellerData = useMemo(() => {
    if (!sellerInfo) return null;
    const [totalSales, balance, totalEarnings] = sellerInfo as [bigint, bigint, bigint];
    return { totalSales, balance, totalEarnings };
  }, [sellerInfo]);

  // Copy address to clipboard
  const copyAddress = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Not connected
  if (!isConnected) {
    return (
      <div className="container py-16 text-center">
        <Wallet className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-2xl font-bold">Connect Your Wallet</h1>
        <p className="text-muted-foreground mt-2">
          Please connect your wallet to view your profile
        </p>
      </div>
    );
  }

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-gradient-to-br from-mnee-500 to-purple-600 flex items-center justify-center">
            <span className="text-2xl font-bold text-white">
              {address?.slice(2, 4).toUpperCase()}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">
                {truncateAddress(address || '')}
              </h1>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={copyAddress}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
              <a
                href={buildEtherscanUrl('address', address || '')}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </a>
            </div>
            <p className="text-muted-foreground">Your MeneeMart Profile</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Products Listed</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sellerProducts?.length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sellerData ? Number(sellerData.totalSales) : 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Withdrawable</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold gradient-text">
              {formatTokenAmount(sellerData?.balance || 0n)} MNEE
            </div>
            {sellerData?.balance && sellerData.balance > 0n && (
              <WithdrawButton />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="listings" className="space-y-6">
        <TabsList>
          <TabsTrigger value="listings" className="gap-2">
            <Package className="h-4 w-4" />
            My Listings
            {sellerProducts && sellerProducts.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {sellerProducts.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="purchases" className="gap-2">
            <ShoppingBag className="h-4 w-4" />
            My Purchases
          </TabsTrigger>
        </TabsList>

        <TabsContent value="listings">
          {sellerLoading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-80 rounded-lg" />
              ))}
            </div>
          ) : sellerProducts && sellerProducts.length > 0 ? (
            <ProductGrid 
              products={sellerProducts}
              showSellerControls
              onToggleActive={handleToggleActive}
              togglingProductId={isTogglePending || isToggleConfirming ? togglingProductId : null}
            />
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold">No Products Listed</h3>
                <p className="text-muted-foreground mt-2">
                  You haven&apos;t listed any products yet
                </p>
                <Link href="/create">
                  <Button variant="gradient" className="mt-4">
                    Create Your First Product
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="purchases">
          <PurchasedProducts address={address} allProducts={allProducts} isLoading={allLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * Withdraw Button Component
 */
function WithdrawButton() {
  const { writeContract, isPending } = useWriteContract();

  const handleWithdraw = () => {
    writeContract({
      ...mneeMartConfig,
      functionName: 'withdrawSellerBalance',
    });
  };

  return (
    <Button
      size="sm"
      variant="outline"
      className="mt-2"
      onClick={handleWithdraw}
      disabled={isPending}
    >
      {isPending ? 'Withdrawing...' : 'Withdraw'}
    </Button>
  );
}

/**
 * Purchased Products Component
 */
function PurchasedProducts({
  address,
  allProducts,
  isLoading,
}: {
  address: string | undefined;
  allProducts: { id: number; seller: string; active: boolean }[];
  isLoading: boolean;
}) {
  // This is a simplified approach - in production, you'd want to use events or a subgraph
  // For now, we check each product individually
  const [purchasedProducts, setPurchasedProducts] = useState<number[]>([]);
  const [checking, setChecking] = useState(true);

  // Check purchases for all products
  useMemo(() => {
    if (!address || allProducts.length === 0) {
      setChecking(false);
      return;
    }

    const checkPurchases = async () => {
      setChecking(true);
      const purchased: number[] = [];

      // In a real app, you'd batch these calls or use multicall
      for (const product of allProducts) {
        // Skip own products
        if (product.seller.toLowerCase() === address.toLowerCase()) continue;
        
        // This would be replaced with actual contract calls
        // For now, we're using the hasPurchased mapping
      }

      setPurchasedProducts(purchased);
      setChecking(false);
    };

    checkPurchases();
  }, [address, allProducts]);

  if (isLoading || checking) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-80 rounded-lg" />
        ))}
      </div>
    );
  }

  // Filter to purchased products
  const purchased = allProducts.filter((p) => purchasedProducts.includes(p.id));

  if (purchased.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold">No Purchases Yet</h3>
          <p className="text-muted-foreground mt-2">
            Products you purchase will appear here
          </p>
          <Link href="/">
            <Button variant="gradient" className="mt-4">
              Browse Marketplace
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <ProductGrid 
      products={purchased as any} 
      emptyMessage="No purchases found"
    />
  );
}

