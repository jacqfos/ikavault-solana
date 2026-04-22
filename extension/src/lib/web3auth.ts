/// Web3Auth integration — Google OAuth → ed25519 Solana wallet
///
/// Uses MetaMask Embedded Wallets (formerly Web3Auth Modal).
/// The user signs in with Google and gets a non-custodial Solana wallet.

import type { AuthState } from "./types";

const WEB3AUTH_CLIENT_ID = import.meta.env.VITE_WEB3AUTH_CLIENT_ID as string;

const SOLANA_DEVNET_CHAIN_CONFIG = {
  chainNamespace: "solana" as const,
  chainId: "0x3", // devnet
  rpcTarget: "https://api.devnet.solana.com",
  displayName: "Solana Devnet",
  blockExplorer: "https://explorer.solana.com",
  ticker: "SOL",
  tickerName: "Solana",
};

let web3authInstance: unknown = null;

/**
 * Initialize Web3Auth. Must be called before login.
 */
export async function initWeb3Auth(): Promise<void> {
  // Dynamic import to avoid bundling issues in service worker
  const { Web3Auth } = await import("@web3auth/modal");
  const { SolanaPrivateKeyProvider } = await import("@web3auth/solana-provider");

  const privateKeyProvider = new SolanaPrivateKeyProvider({
    config: { chainConfig: SOLANA_DEVNET_CHAIN_CONFIG },
  });

  const web3auth = new Web3Auth({
    clientId: WEB3AUTH_CLIENT_ID,
    web3AuthNetwork: "sapphire_devnet",
    privateKeyProvider,
  });

  await web3auth.initModal();
  web3authInstance = web3auth;
}

/**
 * Sign in with Google via Web3Auth.
 * Returns auth state with Solana public key.
 */
export async function loginWithGoogle(): Promise<AuthState> {
  if (!web3authInstance) {
    await initWeb3Auth();
  }

  const { Web3Auth } = await import("@web3auth/modal");
  const web3auth = web3authInstance as InstanceType<typeof Web3Auth>;

  await web3auth.connect();

  const userInfo = await web3auth.getUserInfo();
  const solanaProvider = web3auth.provider;

  if (!solanaProvider) {
    throw new Error("Web3Auth provider not available after login");
  }

  // Get Solana public key
  const { PublicKey } = await import("@solana/web3.js");
  const accounts = await solanaProvider.request<string[]>({ method: "getAccounts" });
  const publicKey = accounts?.[0] ?? "";

  // Validate it's a valid Solana key
  new PublicKey(publicKey);

  return {
    status: "authenticated",
    publicKey,
    displayName: userInfo.name ?? undefined,
    profilePicture: userInfo.profileImage ?? undefined,
  };
}

/**
 * Return the current Web3Auth Solana provider (for signing transactions).
 * Returns null if not logged in.
 */
export function getSolanaProvider(): unknown {
  if (!web3authInstance) return null;
  const { Web3Auth } = { Web3Auth: null as never };
  void Web3Auth; // satisfy linter — web3authInstance already typed as unknown
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (web3authInstance as any).provider ?? null;
}

/**
 * Sign out from Web3Auth.
 */
export async function logout(): Promise<void> {
  if (!web3authInstance) return;

  const { Web3Auth } = await import("@web3auth/modal");
  const web3auth = web3authInstance as InstanceType<typeof Web3Auth>;

  await web3auth.logout();
  web3authInstance = null;
}

/**
 * Check if the user is currently logged in.
 */
export async function getAuthStatus(): Promise<AuthState> {
  if (!web3authInstance) {
    return { status: "unauthenticated" };
  }

  const { Web3Auth } = await import("@web3auth/modal");
  const web3auth = web3authInstance as InstanceType<typeof Web3Auth>;

  if (web3auth.status === "connected") {
    const userInfo = await web3auth.getUserInfo();
    const accounts = await web3auth.provider?.request<string[]>({ method: "getAccounts" });
    return {
      status: "authenticated",
      publicKey: accounts?.[0] ?? undefined,
      displayName: userInfo.name ?? undefined,
      profilePicture: userInfo.profileImage ?? undefined,
    };
  }

  return { status: "unauthenticated" };
}

/**
 * Get the raw Solana private key (base64) from Web3Auth.
 * Used to derive the PBKDF2 salt: SHA-256(privkey).
 * NEVER stored directly — only its hash is persisted.
 */
export async function getPrivateKey(): Promise<string> {
  if (!web3authInstance) {
    throw new Error("Web3Auth not initialized");
  }

  const { Web3Auth } = await import("@web3auth/modal");
  const web3auth = web3authInstance as InstanceType<typeof Web3Auth>;

  if (!web3auth.provider) {
    throw new Error("Web3Auth provider not available");
  }

  const privKey = await web3auth.provider.request<string>({
    method: "solanaPrivateKey",
  });

  if (!privKey) {
    throw new Error("Could not retrieve private key from Web3Auth");
  }

  // privKey comes as hex string — convert to base64 for uniform handling
  const bytes = new Uint8Array(
    (privKey as string).match(/.{1,2}/g)!.map((b) => parseInt(b, 16))
  );
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Sign a transaction using Web3Auth Solana provider.
 */
export async function signTransaction(transaction: unknown): Promise<unknown> {
  if (!web3authInstance) {
    throw new Error("Web3Auth not initialized");
  }

  const { Web3Auth } = await import("@web3auth/modal");
  const web3auth = web3authInstance as InstanceType<typeof Web3Auth>;

  if (!web3auth.provider) {
    throw new Error("Web3Auth provider not available");
  }

  return web3auth.provider.request({
    method: "signTransaction",
    params: { message: transaction },
  });
}
