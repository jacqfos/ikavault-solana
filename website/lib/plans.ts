export type PlanId = "free" | "pro" | "team";
export type Chain = "solana" | "sui" | "ika";
export type Stablecoin = "usdc" | "usdt";
export type Term = "annual" | "lifetime";

export interface PlanTerm {
  /** USD price, same across chains and stablecoins */
  usd: number;
  /** null = lifetime / no expiry */
  expiryDays: number | null;
}

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  highlight?: boolean;
  features: string[];
  /** Empty object for Free; annual+lifetime for paid plans */
  terms: Partial<Record<Term, PlanTerm>>;
  passName: string | null;
}

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    tagline: "Try the vault, no strings.",
    features: [
      "Up to 25 credentials",
      "1 device",
      "Google login",
      "Autofill on any site",
    ],
    terms: {},
    passName: null,
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "Lifetime vault on your terms.",
    highlight: true,
    features: [
      "Unlimited credentials",
      "Unlimited devices",
      "Credential sharing",
      "FHE encrypted search",
      "Priority Walrus storage",
      "Early access to features",
    ],
    terms: {
      annual: { usd: 49, expiryDays: 365 },
      lifetime: { usd: 149, expiryDays: null },
    },
    passName: "IkaVault Pro Pass",
  },
  {
    id: "team",
    name: "Team",
    tagline: "Share across a crew.",
    features: [
      "Everything in Pro",
      "5 seats included",
      "Team ACL + revoke",
      "Shared vault folders",
      "Audit log",
    ],
    terms: {
      annual: { usd: 149, expiryDays: 365 },
      lifetime: { usd: 399, expiryDays: null },
    },
    passName: "IkaVault Team Pass",
  },
];

export const CHAINS: Array<{
  id: Chain;
  name: string;
  short: string;
  tagline: string;
  enabled: boolean;
  comingSoonNote?: string;
}> = [
  {
    id: "solana",
    name: "Solana",
    short: "SOL",
    tagline: "Pay in USDC or USDT on Solana.",
    enabled: true,
  },
  {
    id: "sui",
    name: "Sui",
    short: "SUI",
    tagline: "Pay in USDC or USDT on Sui.",
    enabled: true,
  },
  {
    id: "ika",
    name: "Ika",
    short: "IKA",
    tagline: "Pay on the Ika network.",
    enabled: false,
    comingSoonNote: "Coming when Ika mainnet lives",
  },
];

export const STABLECOINS: Array<{
  id: Stablecoin;
  name: string;
  short: string;
}> = [
  { id: "usdc", name: "USD Coin", short: "USDC" },
  { id: "usdt", name: "Tether", short: "USDT" },
];

export const TREASURY = {
  solana:
    process.env.NEXT_PUBLIC_TREASURY_SOL ||
    "11111111111111111111111111111111",
  sui:
    process.env.NEXT_PUBLIC_TREASURY_SUI ||
    "0x0000000000000000000000000000000000000000000000000000000000000000",
} as const;

/**
 * SPL mints on Solana mainnet-beta. Both stablecoins use 6 decimals.
 * Override via NEXT_PUBLIC_* env if pointing at a different cluster.
 */
export const SOLANA_MINTS: Record<Stablecoin, { mint: string; decimals: number }> = {
  usdc: {
    mint:
      process.env.NEXT_PUBLIC_USDC_MINT_SOLANA ||
      "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    decimals: 6,
  },
  usdt: {
    mint:
      process.env.NEXT_PUBLIC_USDT_MINT_SOLANA ||
      "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    decimals: 6,
  },
};

/**
 * Sui coin types. USDC default is native Circle USDC on Sui.
 * USDT default is Wormhole-bridged USDT (the most-used USDT variant on Sui).
 * Override via NEXT_PUBLIC_* env if using a different bridge/version.
 */
export const SUI_COIN_TYPES: Record<Stablecoin, string> = {
  usdc:
    process.env.NEXT_PUBLIC_USDC_COIN_TYPE_SUI ||
    "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC",
  usdt:
    process.env.NEXT_PUBLIC_USDT_COIN_TYPE_SUI ||
    "0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab08c::coin::COIN",
};
