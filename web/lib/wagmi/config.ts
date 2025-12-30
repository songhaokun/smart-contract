/**
 * Wagmi Configuration
 * Setup for wallet connection and chain configuration
 * 
 * IMPORTANT: The first chain in the array is the default chain.
 * This configuration respects NEXT_PUBLIC_CHAIN environment variable.
 */

import { http } from 'wagmi';
import { mainnet, sepolia } from 'wagmi/chains';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { CURRENT_CHAIN, RPC_URLS, APP_CONFIG, CHAIN_IDS } from '@/lib/constants';

/**
 * Supported chains configuration
 * The first chain is the default/primary chain
 * 
 * When CURRENT_CHAIN is 'sepolia', sepolia is the only chain (safer for testing)
 * When CURRENT_CHAIN is 'mainnet', mainnet is the only chain (production)
 */
const chains = CURRENT_CHAIN === 'mainnet' 
  ? [mainnet] as const
  : [sepolia] as const;  // Only sepolia for testnet mode - prevents accidental mainnet transactions

/**
 * Wagmi config with RainbowKit defaults
 */
export const wagmiConfig = getDefaultConfig({
  appName: APP_CONFIG.name,
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '',
  chains,
  transports: {
    [mainnet.id]: http(RPC_URLS.mainnet),
    [sepolia.id]: http(RPC_URLS.sepolia),
  },
  ssr: true, // Enable server-side rendering support
});

/**
 * Get the current chain object
 */
export function getCurrentChain() {
  return CURRENT_CHAIN === 'mainnet' ? mainnet : sepolia;
}

/**
 * Get chain ID for current environment
 */
export function getCurrentChainId() {
  return CHAIN_IDS[CURRENT_CHAIN];
}
