# IkaVault

> **Decentralized browser password manager on Solana.**
> Keys split 2-of-2 between you and the Ika network — no server ever holds a complete key. Vaults encrypted client-side, stored on Walrus.

Built for the [Colosseum Solana Frontier Hackathon](https://www.colosseum.com/) (April–May 2026).

- **Site:** *(Walrus Sites deployment pending)*
- **Extension:** see [Install](#install) below
- **Source:** you're looking at it

---

## Why

Password managers today ask you to trust a single vendor with an encrypted blob — if the vendor's key custody is broken, your passwords leak (see: LastPass 2022). IkaVault removes the single point of trust:

- **No master password.** Google login via Web3Auth derives a Solana keypair.
- **No full key anywhere.** Ika's 2PC-MPC protocol splits the encryption key between your browser and a decentralized validator set. Neither side alone can decrypt.
- **No proprietary server.** Encrypted vaults live on Walrus (decentralized blob storage). Vault pointers and ACLs live on Solana.
- **No pull-payment surveillance.** Pro plans are one-time stablecoin transfers. Annual or Lifetime.

## Architecture

```
┌────────────────────────────────────────────┐
│  Browser Extension (React + TypeScript)    │
│  ┌───────────────┐  ┌──────────────────┐   │
│  │ Web3Auth      │  │ Ika dWallet      │   │
│  │ Google OAuth  │  │ 2PC-MPC          │   │
│  │ → SOL wallet  │  │ split-key encrypt│   │
│  └───────┬───────┘  └────────┬─────────┘   │
└──────────┼───────────────────┼─────────────┘
           │                   │
     ┌─────▼──────┐    ┌──────▼─────────┐
     │  Solana    │    │  Walrus         │
     │  (Anchor)  │◄───┤  (encrypted     │
     │  vault     │    │   vault blobs)  │
     │  pointers  │    └─────────────────┘
     └────────────┘
```

**Four protocols, one vault:**

| Layer     | Tech                 | Purpose                                                  |
|-----------|----------------------|----------------------------------------------------------|
| Auth      | Web3Auth             | Google OAuth → ed25519 Solana key, no seed phrase        |
| Signing   | Ika 2PC-MPC          | Split-key EdDSA, user share + network share              |
| Storage   | Walrus               | Decentralized encrypted blobs, content-addressed         |
| Compute   | Encrypt FHE (stretch)| On-chain search over ciphertext, no decrypt              |

## Install

> **Note:** the extension is not yet on the Chrome Web Store. For now, load it unpacked from the release zip below.

1. Download [`ikavault-extension.zip`](https://github.com/jacqfos/ikavault-solana/raw/main/ikavault-extension.zip)
2. Unzip to a folder (any location)
3. Open `chrome://extensions`
4. Top-right: **Developer mode** ON
5. Click **Load unpacked** → select the unzipped folder
6. Pin the IkaVault icon from the extensions toolbar
7. Click the icon → **Sign in with Google** → you're in

**Works in:** Chrome, Brave, Edge. Firefox support not tested.

**Known dev-environment gotcha:** if you have MetaMask installed, its SES lockdown removes `crypto.randomUUID` from the global scope, which silently breaks Phantom's content script on **any** dApp (not just ours). Disable MetaMask or use a separate browser profile when testing Phantom-based payments.

## Repo layout

```
programs/           # Anchor programs
  ikavault/         # Vault pointer PDAs, entry CRUD, ACL
  encrypt-search/   # FHE search (stretch goal)
client/             # Rust off-chain gRPC client for Ika dWallet
extension/          # Browser extension source (React + Vite)
website/            # Marketing + checkout site (Next.js static, deployed to Walrus Sites)
ikavault-dist/dist/ # Built extension (source for ikavault-extension.zip)
tests/              # Anchor integration tests
```

## Dev setup

### Prerequisites
- Rust (edition 2024)
- Solana CLI 3.x+
- Anchor CLI 1.x
- Node 20+

### Build the Anchor program
```bash
anchor build
```

### Build the extension
```bash
cd extension
npm install
npm run build   # output lands in ikavault-dist/dist/
```

### Run the website locally
```bash
cd website
npm install
npm run dev     # http://localhost:3100
```

### Deploy the website (Walrus Sites)
```bash
cd website
rm -rf out .next && npm run build
site-builder publish ./out --epochs 30
```
Then register a SuiNS name at [suins.io](https://suins.io) and set target address to the printed `0x<site-object-id>`.

## Environment

| Resource       | Endpoint                                          |
|----------------|---------------------------------------------------|
| Solana RPC     | `https://api.mainnet-beta.solana.com`             |
| Ika dWallet    | `https://pre-alpha-dev-1.ika.ika-network.net:443` |
| Walrus Publisher | Staketab public publisher                       |

Ika Solana is **pre-alpha** (mock signer, not real MPC yet). On-chain state may be wiped periodically. Fine for hackathon demo; not production-ready.

## Payment flow

Pricing is stablecoin-only (USDC / USDT), priced in flat USD to avoid native-token drift. Paid as a plain `SystemProgram.transfer` (Solana) or Sui `coin::transfer` — no custom program, no backend. Pro unlock in the extension is tx-hash based.

- Free: $0, 25 entries
- Pro Annual: $49 / year
- Pro Lifetime: $149 one-time
- Team: $149 annual / $399 lifetime

## License

MIT. See LICENSE file (or consider this paragraph one while it's still hackathon week).

## Credits

- Ika Labs / dWallet Labs — 2PC-MPC protocol and SDK
- Mysten Labs — Walrus storage, Sui SDK
- Encrypt Labs — FHE primitives
- Web3Auth — embedded wallet infra
- Colosseum — hackathon framework and Copilot
