/**
 * Contract Configuration
 * Wagmi contract config objects for type-safe interactions
 * 
 * IMPORTANT: Always includes chainId to ensure transactions
 * are sent to the correct network
 */

import { type Address } from 'viem';
import { mainnet, sepolia } from 'wagmi/chains';
import { getContractAddresses, CURRENT_CHAIN, CHAIN_IDS } from '@/lib/constants';
import { MneeMartAbi, Erc20Abi } from './abis';

// Get addresses for current chain
const addresses = getContractAddresses();

/**
 * Get the correct chain object based on current environment
 */
export function getCurrentChainObject() {
  return CURRENT_CHAIN === 'mainnet' ? mainnet : sepolia;
}

/**
 * Get the current chain ID
 */
export function getCurrentChainId() {
  return CHAIN_IDS[CURRENT_CHAIN];
}

/**
 * MneeMart contract configuration
 * Includes chainId to ensure transactions go to the correct network
 */
export const mneeMartConfig = {
  address: addresses.mneeMart as Address,
  abi: MneeMartAbi,
  chainId: getCurrentChainId(),
} as const;

/**
 * MNEE Token contract configuration
 * Includes chainId to ensure transactions go to the correct network
 */
export const mneeTokenConfig = {
  address: addresses.mneeToken as Address,
  abi: Erc20Abi,
  chainId: getCurrentChainId(),
} as const;

/**
 * Get MneeMart config with custom address
 * Useful for multi-chain support
 */
export function getMneeMartConfig(address: Address, chainId?: number) {
  return {
    address,
    abi: MneeMartAbi,
    chainId: chainId ?? getCurrentChainId(),
  } as const;
}

/**
 * Get ERC20 config with custom address
 */
export function getErc20Config(address: Address, chainId?: number) {
  return {
    address,
    abi: Erc20Abi,
    chainId: chainId ?? getCurrentChainId(),
  } as const;
}
