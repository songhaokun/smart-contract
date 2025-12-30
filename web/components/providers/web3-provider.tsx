'use client';

/**
 * Web3 Provider
 * Wraps the app with wagmi, RainbowKit, and React Query providers
 * 
 * IMPORTANT: This component handles SSR/Hydration properly by:
 * 1. Using useState for QueryClient to maintain stable reference
 * 2. Using mounted state to avoid hydration mismatch with theme
 */

import { ReactNode, useState, useEffect } from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, darkTheme, lightTheme } from '@rainbow-me/rainbowkit';
import { useTheme } from 'next-themes';
import { wagmiConfig } from '@/lib/wagmi';
import { getCurrentChainId } from '@/lib/contracts/config';

import '@rainbow-me/rainbowkit/styles.css';

interface Web3ProviderProps {
  children: ReactNode;
}

// Custom RainbowKit themes - defined outside component to prevent recreation
const customDarkTheme = darkTheme({
  accentColor: '#6366f1', // MNEE primary color
  accentColorForeground: 'white',
  borderRadius: 'medium',
  fontStack: 'system',
});

const customLightTheme = lightTheme({
  accentColor: '#6366f1',
  accentColorForeground: 'white',
  borderRadius: 'medium',
  fontStack: 'system',
});

export function Web3Provider({ children }: Web3ProviderProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  // Create a stable QueryClient instance
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Stale time for caching
            staleTime: 1000 * 60, // 1 minute
            // Retry failed requests
            retry: 2,
            // Refetch on window focus
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  // Prevent hydration mismatch by only rendering theme-dependent content after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Use dark theme as default during SSR to match the default system preference
  // This prevents flash of unstyled content
  const theme = mounted
    ? resolvedTheme === 'dark'
      ? customDarkTheme
      : customLightTheme
    : customDarkTheme;

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={theme}
          modalSize="compact"
          initialChain={getCurrentChainId()}
          appInfo={{
            appName: 'MeneeMart',
            learnMoreUrl: 'https://meneemart.xyz/about',
          }}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
