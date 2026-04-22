# IkaVault website

Marketing site + pricing + multi-chain checkout for the IkaVault browser extension.

**Hosted on Walrus Sites. Routed via `@ikavault.sui` (SuiNS).** No Vercel, no AWS.

## Stack

- Next.js **14.2.15** (App Router, **static export**)
- React **18.3** + TypeScript 5.6
- Tailwind CSS 3.4
- Framer Motion 11
- `@solana/wallet-adapter` (Phantom, Solflare, Backpack)
- `@mysten/dapp-kit` 0.14 (Sui Wallet, Slush)

> Version pins are load-bearing: Next 15 + React 19 RC break `@solana/wallet-adapter-react` (no React-19 peer), `@types/react` 18.2.79 override fixes `ConnectionProvider` JSX typing, and `@mysten/sui` 1.24.0 override avoids a dual-`Transaction` class issue with `@mysten/dapp-kit` 0.14. Don't loosen the `overrides` block without re-testing `npm run build`.

## What's here

| Path | Purpose |
| --- | --- |
| `app/page.tsx` | Hero, How-it-works, Features, Architecture, Dogfood, Footer |
| `app/pricing/page.tsx` | Plans + chain selector + checkout modal + FAQ |
| `components/hero/SplitKeyOrb.tsx` | Animated 2PC-MPC split-key hero visual (CSS/SVG, no R3F) |
| `components/payment/ChainSelector.tsx` | Solana / Sui / Ika pay toggle (Ika disabled, coming soon) |
| `components/payment/PaymentModal.tsx` | Full USDC/USDT checkout flow, on-chain verified |
| `lib/payment/solana.ts` | Build SPL `transferChecked` tx + poll RPC for reference |
| `lib/payment/sui.ts` | Build Sui PTB that splits + transfers USDC / USDT coin type |
| `lib/plans.ts` | Plan terms (Annual/Lifetime), stablecoin mints, treasury addresses |
| `lib/useChainPreference.ts` | localStorage-backed chain selector across routes |
| `public/ws-resources.json` | Walrus Sites headers + metadata (copied to `out/` at build time) |

## Dev

```bash
cd website
npm install
cp .env.example .env
npm run dev
# → http://localhost:3100
```

## Build (static export)

```bash
npm run build
# → ./out/  (ready for Walrus Sites)
```

## Deploy to Walrus Sites + SuiNS

### Prerequisites (one-time, on your machine)

1. **Sui CLI** with a mainnet-configured keypair that will *own* the site object:
   ```bash
   sui client new-env --alias mainnet --rpc https://fullnode.mainnet.sui.io:443
   sui client switch --env mainnet
   sui client active-address        # save this — it's the site owner
   ```
2. **Fund the Sui wallet** with:
   - A few SUI for transaction gas (rule of thumb: ≥ 2 SUI covers site publish + SuiNS register + set-target)
   - **WAL** (Walrus token) for blob storage. Acquire via DEX or the Walrus faucet if still open.
3. **site-builder CLI** — the Walrus Sites publisher. Install per the official tutorial:
   <https://docs.wal.app/walrus-sites/tutorial-install.html>
   Verify with `site-builder --version`.

### Set treasury addresses and production env

Copy the example env, fill in the real treasuries:

```bash
cp .env.example .env
```

Required in `.env`:
- `NEXT_PUBLIC_TREASURY_SOL` — Solana mainnet pubkey that receives USDC/USDT (any wallet address you control)
- `NEXT_PUBLIC_TREASURY_SUI` — Sui mainnet 0x-address that receives USDC/USDT
- `NEXT_PUBLIC_SOLANA_RPC` — mainnet RPC (default `https://api.mainnet-beta.solana.com` is rate-limited; a Helius / Triton RPC is recommended for production)

The `NEXT_PUBLIC_USDC_MINT_SOLANA`, `NEXT_PUBLIC_USDT_MINT_SOLANA`, and the two Sui coin type envs default to mainnet-standard values — only override if you're targeting a non-standard bridge.

### Build and publish

```bash
# 1. Clean build — always nuke out/ and .next/ first to avoid stale chunks
rm -rf out .next
npm run build

# 2. Publish the ./out directory to Walrus for 30 epochs (≈2 weeks per epoch)
site-builder publish ./out --epochs 30
# → prints a "Created new site: 0x<site-object-id>"  — save that ID
```

### Attach the SuiNS name

Go to <https://suins.io> (or use the CLI), and:

1. Register `ikavault` (or the name of your choice) — this costs SUI
2. Set the target address to the **site object ID** (not a wallet address):
   - via the web UI: "Manage → Set Target Address" → paste `0x<site-object-id>`
   - or via CLI if you prefer

The site is now reachable at:

- `https://ikavault.walrus.site` — Walrus Sites portal gateway (works without SuiNS)
- `https://ikavault.sui.link` or `@ikavault.sui` in a Walrus-aware wallet — SuiNS-routed
- Any Walrus-Sites-aware browser via the raw object ID

### Updating the site later

```bash
rm -rf out .next
npm run build
site-builder update --site-object 0x<site-object-id> ./out --epochs 30
```

The object ID stays the same, so the SuiNS attachment doesn't need to change — only the content behind it.

## Payment flow (no backend, no custom program)

1. User picks plan + term (Annual / Lifetime) + chain on `/pricing`.
2. User picks stablecoin (USDC / USDT) at checkout.
3. Client generates a disposable reference pubkey (Solana) or uses the wallet
   address (Sui).
4. Wallet signs a **plain stablecoin transfer** to the treasury ATA — SPL
   `transferChecked` on Solana, a PTB `splitCoins` + `transferObjects` on Sui
   using the stablecoin coin type.
5. Client polls RPC until the tx confirms, then shows the explorer link.
6. Pro-unlock for the extension gates client-side on the confirmed tx
   signature, or re-verifies on-chain by reading the treasury ATA's inflows.
   For Annual, the extension enforces the 365-day expiry off the tx timestamp.

No API, no database, no custom Solana/Sui program required to run this site.

## TODO

- Set real treasury addresses in `.env` (`NEXT_PUBLIC_TREASURY_SOL`, `NEXT_PUBLIC_TREASURY_SUI`)
- Confirm the right Sui USDC / USDT coin types for your target deployment (defaults are native Circle USDC + Wormhole USDT — override via env if you use a different bridge)
- Light up Ika chain option when Ika mainnet + stablecoin bridges are live
- Real GitHub + Twitter links in Nav/Footer

## Done

- Landing with animated split-key orb + Roadmap + Security sections
- Pricing + **USDC / USDT checkout** on Solana (SPL `transferChecked`) and Sui (PTB coin-type transfer) — **pure client-side, no on-chain program required**
- Annual / Lifetime plan terms with flat USD pricing (no SOL/SUI price drift)
- `/docs` architecture deep-dive
- `/changelog` weekly updates
- Custom 404
- Favicon (SVG) + OG image (PNG 1200×630, SVG source kept)
- Walrus Sites config (`ws-resources.json`)
- Chain selector persists across routes (`localStorage`-backed)
