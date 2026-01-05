'use client';

/**
 * usePurchase Hook
 * Handles the complete purchase flow: Approve → Buy
 */

import { useState, useCallback, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { mneeMartConfig, mneeTokenConfig } from '@/lib/contracts';
import type { PurchaseState } from '@/lib/constants/types';
import { getErrorMessage } from '@/lib/utils';

interface UsePurchaseOptions {
  productId: number;
  price: bigint;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export function usePurchase({ productId, price, onSuccess, onError }: UsePurchaseOptions) {
  const { address } = useAccount();
  const [state, setState] = useState<PurchaseState>('idle');
  const [error, setError] = useState<string | null>(null);

  // Check current allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    ...mneeTokenConfig,
    functionName: 'allowance',
    args: address && mneeMartConfig.address 
      ? [address, mneeMartConfig.address] 
      : undefined,
    query: {
      enabled: !!address && !!mneeMartConfig.address,
    },
  });

  // Check user balance
  const { data: balance } = useReadContract({
    ...mneeTokenConfig,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  // Write contracts
  const { 
    writeContract: writeApprove, 
    data: approveHash,
    isPending: isApproving,
    reset: resetApprove,
  } = useWriteContract();

  const { 
    writeContract: writePurchase, 
    data: purchaseHash,
    isPending: isPurchasing,
    reset: resetPurchase,
  } = useWriteContract();

  // Wait for transactions
  const { isLoading: isWaitingApproval, isSuccess: approvalConfirmed } = 
    useWaitForTransactionReceipt({
      hash: approveHash,
    });

  const { isLoading: isWaitingPurchase, isSuccess: purchaseConfirmed } = 
    useWaitForTransactionReceipt({
      hash: purchaseHash,
    });

  // Derived states
  const needsApproval = allowance !== undefined && allowance < price;
  const hasInsufficientBalance = balance !== undefined && balance < price;

  // Handle approve
  const handleApprove = useCallback(async () => {
    if (!address || !mneeMartConfig.address) return;

    try {
      setState('approving');
      setError(null);

      writeApprove({
        ...mneeTokenConfig,
        functionName: 'approve',
        args: [mneeMartConfig.address, price],
        gas: BigInt(100_000), // Explicit gas limit for ERC20 approve
      }, {
        onSuccess: () => {
          setState('waiting_approval');
        },
        onError: (err) => {
          const msg = getErrorMessage(err);
          setError(msg);
          setState('error');
          onError?.(msg);
        },
      });
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      setState('error');
      onError?.(msg);
    }
  }, [address, price, writeApprove, onError]);

  // Handle purchase
  const handlePurchase = useCallback(async () => {
    if (!address) return;

    try {
      setState('purchasing');
      setError(null);

      writePurchase({
        ...mneeMartConfig,
        functionName: 'purchaseProduct',
        args: [BigInt(productId)],
        gas: BigInt(300_000), // Explicit gas limit for purchase
      }, {
        onSuccess: () => {
          setState('waiting_purchase');
        },
        onError: (err) => {
          const msg = getErrorMessage(err);
          setError(msg);
          setState('error');
          onError?.(msg);
        },
      });
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      setState('error');
      onError?.(msg);
    }
  }, [address, productId, writePurchase, onError]);

  // Effect: After approval confirmed, proceed to purchase
  useEffect(() => {
    if (approvalConfirmed && state === 'waiting_approval') {
      refetchAllowance();
      setState('idle');
      resetApprove();
    }
  }, [approvalConfirmed, state, refetchAllowance, resetApprove]);

  // Effect: After purchase confirmed
  useEffect(() => {
    if (purchaseConfirmed && state === 'waiting_purchase') {
      setState('success');
      onSuccess?.();
    }
  }, [purchaseConfirmed, state, onSuccess]);

  // Main action handler
  const execute = useCallback(async () => {
    if (hasInsufficientBalance) {
      setError('Insufficient MNEE balance');
      setState('error');
      return;
    }

    if (needsApproval) {
      await handleApprove();
    } else {
      await handlePurchase();
    }
  }, [needsApproval, hasInsufficientBalance, handleApprove, handlePurchase]);

  // Reset state
  const reset = useCallback(() => {
    setState('idle');
    setError(null);
    resetApprove();
    resetPurchase();
  }, [resetApprove, resetPurchase]);

  return {
    state,
    error,
    execute,
    reset,
    needsApproval,
    hasInsufficientBalance,
    isLoading: isApproving || isPurchasing || isWaitingApproval || isWaitingPurchase,
    allowance,
    balance,
    approveHash,
    purchaseHash,
    // Action-specific handlers
    handleApprove,
    handlePurchase,
  };
}

