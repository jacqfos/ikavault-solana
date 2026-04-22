# CLAUDE.md — IkaVault Solana

## Project Overview

IkaVault is a **decentralized browser extension password manager** for the Solana Frontier Hackathon (April 6 – May 11, 2026). It combines Ika 2PC-MPC split-key custody, Encrypt FHE on-chain encrypted compute, Walrus decentralized blob storage, and Web3Auth wallet-free Google OAuth login.

## Hackathon Context

- **Event:** Colosseum Solana Frontier Hackathon
- **Timeline:** April 6 – May 11, 2026 (5 weeks)
- **Tracks:** Infrastructure, Consumer, DeFi, AI+Crypto, Developer Tooling, Physical World
- **Target track:** Infrastructure / Consumer crossover
- **Prizes:** Up to $250K investment from Colosseum fund + accelerator admission
- **Competition:** 9,080 registrations from 131 countries

## Competitive Landscape (validated via Colosseum Copilot)

### Direct competitors (decentralized password managers on Solana):
- **Lockbox** (Cypherpunk) — 🏆 WINNER — encrypted data on Solana, Rust. Simple on-chain storage.
- **Keyra** (Breakout + Cypherpunk) — Light Protocol ZKP + IPFS
- **Genesis** (Renaissance) — MetaMask + wallet-derived encryption keys
- **SolPass** (Radar) — Anchor + React, self-custodial credentials

### Gap classification: PARTIAL GAP
None of the competitors use:
- Ika/dWallet 2PC-MPC split-key custody
- Walrus decentralized blob storage (all use IPFS or on-chain)
- Encrypt FHE for on-chain encrypted compute
- Wallet-free social login (Google OAuth via Web3Auth)

### Winning tech stack pattern (293 winners analyzed):
- Solana: 99.7% | Rust: 45.7% | React: 36.9% | Anchor: 25.6% | TypeScript: 21.2%

## Architecture

```
┌────────────────────────────────────────────┐
│  Browser Extension (React + TypeScript)     │
│  ┌───────────────┐  ┌──────────────────┐   │
│  │ Web3Auth      │  │ Ika dWallet      │   │
│  │ Google OAuth  │  │ 2PC-MPC          │   │
│  │ → SOL wallet  │  │ split-key encrypt│   │
│  │ (ed25519)     │  │ (EdDSA)          │   │
│  └───────┬───────┘  └────────┬─────────┘   │
│     auth layer          encrypt layer      │
└──────────┼───────────────────┼─────────────┘
           │                   │
     ┌─────▼──────┐    ┌──────▼─────────┐
     │  Solana     │    │  Encrypt FHE   │
     │  Program    │    │  (on-chain     │
     │  (Anchor)   │    │   encrypted    │
     │  - vault    │    │   compute)     │
     │    pointers │    │               │
     │  - ACL/     │    └──────┬────────┘
     │    policies │           │
     └─────┬──────┘    ┌──────▼────────┐
           │           │  Walrus       │
           └──────────►│  Blob Store   │
                       │  (encrypted   │
                       │   vault data) │
                       └───────────────┘
```

## Tech Stack

### On-chain (Rust / Anchor)
- **Framework:** Anchor 1.x
- **Ika SDK:** `ika-dwallet-anchor` from `https://github.com/dwallet-labs/ika-pre-alpha`
- **Ika gRPC:** `ika-grpc` + `ika-dwallet-types` for off-chain client
- **Solana RPC:** `https://api.devnet.solana.com`
- **Ika gRPC endpoint:** `https://pre-alpha-dev-1.ika.ika-network.net:443`
- **Note:** Ika Solana is PRE-ALPHA — mock signer only, no real MPC. Fine for hackathon demo.

### Frontend (Browser Extension)
- **Framework:** React + TypeScript + Vite
- **Auth:** Web3Auth (MetaMask Embedded Wallets) — Google OAuth → ed25519 Solana wallet
- **Solana SDK:** `@solana/web3.js`
- **Styling:** Tailwind CSS, OLED-friendly dark theme

### Storage
- **Walrus:** Decentralized blob storage for encrypted vault data
- **Existing pattern:** Reuse Walrus upload/download logic from previous projects (Staketab publisher)

### Encrypt FHE (stretch goal)
- **Docs:** `https://docs.encrypt.xyz`
- **Status:** Also pre-alpha/devnet Q2 2026
- **Use case:** On-chain encrypted credential comparison/search without decryption

## Ika Solana Pre-Alpha Specifics

### Important caveats (from official docs):
- NO real MPC signing — single mock signer
- Keys, trust model, signing protocol NOT final
- All on-chain data will be wiped periodically
- APIs and data formats subject to change

### Dependencies (Cargo.toml):
```toml
# Anchor program
[dependencies]
ika-dwallet-anchor = { git = "https://github.com/dwallet-labs/ika-pre-alpha" }
anchor-lang = "1"

# Off-chain gRPC client
[dependencies]
ika-grpc = { git = "https://github.com/dwallet-labs/ika-pre-alpha" }
ika-dwallet-types = { git = "https://github.com/dwallet-labs/ika-pre-alpha" }
tokio = { version = "1", features = ["rt-multi-thread", "macros"] }

# SDK types (PDA helpers, account readers)
[dependencies]
ika-sdk-types = { package = "ika-solana-sdk-types", git = "https://github.com/dwallet-labs/ika-pre-alpha" }
```

### Environment:
| Resource       | Endpoint                                          |
|----------------|---------------------------------------------------|
| dWallet gRPC   | `https://pre-alpha-dev-1.ika.ika-network.net:443` |
| Solana RPC     | `https://api.devnet.solana.com`                   |
| Program ID     | TBD (after deployment)                            |

### Prerequisites:
- Rust (edition 2024): `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- Solana CLI 3.x+: `sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"`
- Anchor CLI 1.x

## Project Structure (actual)

```
ikavault-solana/
├── CLAUDE.md                    # This file
├── AUDIT.md / AUDIT_HU.md       # Audit notes
├── Anchor.toml
├── Cargo.toml / Cargo.lock      # Workspace root
├── rust-toolchain.toml
├── programs/
│   ├── ikavault/
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs           # Anchor program entry
│   │       ├── state.rs         # Vault pointer accounts, user profiles
│   │       ├── errors.rs
│   │       └── instructions/
│   │           ├── mod.rs
│   │           ├── init_vault.rs
│   │           ├── add_entry.rs
│   │           ├── update_entry.rs
│   │           ├── delete_entry.rs
│   │           └── share_entry.rs
│   └── encrypt-search/          # FHE stretch-goal program
│       ├── Cargo.toml
│       └── src/lib.rs
├── client/                      # Off-chain Rust gRPC client for Ika
│   ├── Cargo.toml
│   ├── rust-toolchain.toml
│   └── src/
│       ├── main.rs
│       ├── dwallet.rs           # dWallet create/sign operations
│       ├── encrypt.rs           # Encrypt FHE client calls
│       └── walrus.rs            # Walrus upload/download
├── extension/                   # Browser extension (React/TS)
│   ├── .env
│   ├── package.json
│   ├── manifest.json            # Chrome extension manifest v3
│   ├── popup.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── public/icons/            # 16/32/48/128 png
│   └── src/
│       ├── background/          # Service worker (index.ts)
│       ├── content/             # Content scripts (index.ts, autofill)
│       ├── popup/
│       │   ├── App.tsx
│       │   ├── index.tsx
│       │   ├── index.css
│       │   └── views/           # LoginView, VaultView, AddEntryView,
│       │                        # EntryDetailView, PinSetupView, PinUnlockView
│       └── lib/
│           ├── web3auth.ts      # Google OAuth → Solana wallet
│           ├── solana.ts        # Solana program interactions
│           ├── ikavault_idl.json
│           ├── walrus.ts        # Walrus blob operations
│           ├── encryption.ts    # Client-side encrypt/decrypt with dWallet key
│           ├── encrypt.ts       # Encrypt FHE helpers
│           ├── messaging.ts     # popup ↔ background bridge
│           ├── errors.ts
│           └── types.ts
├── ikavault-dist/               # Packed extension build output
└── tests/
    ├── ikavault.ts              # Anchor integration tests
    └── integration.ts
```

## Key User Flows

### 1. Onboarding (new user)
1. User installs browser extension
2. Clicks "Sign in with Google" → Web3Auth creates embedded Solana wallet (ed25519)
3. Extension calls Ika gRPC → creates dWallet (2PC-MPC key pair)
4. Solana program creates user profile PDA with dWallet reference
5. Empty vault blob created on Walrus, pointer stored on-chain

### 2. Save credential
1. User fills login form on website → extension detects
2. Credential encrypted client-side using dWallet split-key
3. Encrypted blob uploaded to Walrus → returns blob ID
4. Solana program updates vault pointer with new Walrus blob ID

### 3. Autofill credential
1. User visits saved website → extension matches URL
2. Extension fetches encrypted blob from Walrus via blob ID from on-chain pointer
3. dWallet 2PC-MPC decrypts credential (user share + Ika network share)
4. Extension autofills the form

### 4. Share credential (stretch goal)
1. User selects credential → "Share with..."
2. Recipient's dWallet public key used to re-encrypt
3. New Walrus blob created for recipient
4. Solana program creates shared vault pointer with ACL

## Development Priorities

### Week 1 (April 6–12): Foundation
- [ ] Anchor program scaffold with vault pointer PDAs
- [ ] Web3Auth Google OAuth integration in extension
- [ ] Basic extension popup UI (dark theme)

### Week 2 (April 13–19): Core
- [ ] Ika dWallet integration (create + sign via gRPC)
- [ ] Client-side encryption using dWallet-derived keys
- [ ] Walrus upload/download integration

### Week 3 (April 20–26): Flow
- [ ] Save credential flow (detect → encrypt → store)
- [ ] Autofill flow (match → fetch → decrypt → fill)
- [ ] Vault listing UI with search

### Week 4 (April 27–May 3): Polish
- [ ] Encrypt FHE integration (stretch goal)
- [ ] Share credential flow (stretch goal)
- [ ] Error handling, loading states, edge cases

### Week 5 (May 4–11): Submit
- [ ] Demo video recording
- [ ] GitHub repo cleanup + README
- [ ] Hackathon submission on Colosseum
- [ ] Weekly updates

## Colosseum Copilot Access

Available for competitive research during development:
```bash
export COLOSSEUM_COPILOT_API_BASE="https://copilot.colosseum.com/api/v1"
export COLOSSEUM_COPILOT_PAT="$COLOSSEUM_COPILOT_PAT"
# Token expires: 2026-07-05
```

## Previous Project Experience (reusable patterns)

The developer has extensive Sui/Ika/Walrus experience from prior projects:
- **Age Gate:** Ika/dWallet 2PC-MPC + REFHE on Sui testnet + Enoki zkLogin
- **Walrus Web Builder:** Vite+React + Express.js, Walrus mainnet uploads via Staketab publisher
- **ProofSnap:** Android app with Walrus mainnet uploads + SHA-256 proof
- **IkaVault (Sui version):** Browser extension password manager using Ika 2PC-MPC + Walrus + Enoki zkLogin (current WIP, being ported to Solana)

### Known patterns to reuse:
- Walrus upload/download logic (Staketab public publisher)
- dWallet 2PC-MPC key creation flow (adapt from Sui SDK to Solana SDK)
- Browser extension structure (manifest v3, popup, background, content scripts)
- Dark OLED-friendly UI styling

### Known gotchas from Sui work (may or may not apply to Solana):
- `js-sha256` as `crypto.subtle` workaround if wallet extension conflicts arise
- Callback-based patterns if SDK methods return undefined in async mode
- SDK version pinning may be necessary with pre-alpha dependencies

## Submission Requirements

Per Colosseum hackathon rules:
- Working demo (deployed on devnet)
- GitHub repo with clear README
- Demo video
- Weekly updates on Colosseum platform
- Project must be NEW (not a pre-existing project ported — position as new Solana-native build)

## Important Note

This is a **new project built for the Solana Frontier Hackathon**. While the developer has prior experience with similar concepts on Sui, IkaVault Solana is built from scratch using Solana-native tooling (Anchor, @solana/web3.js, Web3Auth) and the new Ika Solana pre-alpha SDK. The Sui version's architecture informs the design but no code is directly ported.
