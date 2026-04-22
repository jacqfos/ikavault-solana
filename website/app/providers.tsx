"use client";

import { useMemo } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";
import { SuiClientProvider, WalletProvider as SuiWalletProvider } from "@mysten/dapp-kit";
import { getFullnodeUrl } from "@mysten/sui/client";

import "@solana/wallet-adapter-react-ui/styles.css";
import "@mysten/dapp-kit/dist/index.css";

const suiNetworks = {
  mainnet: { url: getFullnodeUrl("mainnet") },
  testnet: { url: getFullnodeUrl("testnet") },
};

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = useMemo(() => new QueryClient(), []);
  const solanaEndpoint = useMemo(
    () =>
      process.env.NEXT_PUBLIC_SOLANA_RPC ||
      clusterApiUrl("devnet"),
    []
  );
  const solanaWallets = useMemo(
    () => [new SolflareWalletAdapter()],
    []
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ConnectionProvider endpoint={solanaEndpoint}>
        <WalletProvider wallets={solanaWallets} autoConnect={false}>
          <WalletModalProvider>
            <SuiClientProvider networks={suiNetworks} defaultNetwork="testnet">
              <SuiWalletProvider autoConnect={false}>{children}</SuiWalletProvider>
            </SuiClientProvider>
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </QueryClientProvider>
  );
}
