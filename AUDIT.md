# IkaVault Solana — Security Audit Report

**Project:** IkaVault — Decentralized Browser Extension Password Manager
**Network:** Solana Devnet (pre-production)
**Program ID:** `4y4f3BWjnCwAMw7eumBhLveJ6Uvv5i2qdgLCH3Nem6kf`
**Audit type:** Hackathon-grade self-audit, official report format
**Audit date:** 2026-04-18
**Commit state audited:** working tree at the project root as of the audit date
**Scope:** On-chain Anchor program + browser extension (background service worker, popup, content script, crypto layer)
**Out of scope:** Web3Auth internal implementation, Walrus consensus, Ika MPC protocol correctness, Encrypt FHE ciphertext semantics — these are treated as trusted third-party primitives

---

## Executive Summary

IkaVault is an MVP-stage, Solana-native browser extension password manager designed for the Colosseum Solana Frontier Hackathon. It combines **Web3Auth** (Google OAuth → embedded ed25519 wallet), **Ika dWallet 2PC-MPC split-key custody** (pre-alpha, mock signer), **Walrus** decentralized blob storage for encrypted credentials, **Encrypt FHE** for private URL matching (pre-alpha, plaintext fallback), and an **Anchor program** that stores vault pointers and access control on-chain.

The overall architecture is **defensively structured**: credentials never leave the user's device in plaintext, AES-GCM is used with unique nonces, the on-chain program enforces ownership via `has_one` constraints, and the AES key is never persisted — only derived from the user's PIN at unlock time.

However, the audit identifies **two issues that materially weaken the stated threat model** and should be treated as blocking prior to any production deployment:

1. **H-01** — The PIN verifier allows an attacker with read access to `chrome.storage.local` to bypass the 100 000-iteration PBKDF2 barrier entirely and brute-force the PIN offline at raw SHA-256 speed.
2. **H-02** — The plaintext autofill URL matcher uses loose substring containment (`includes()`), which causes credentials for `example.com` to be auto-fill-eligible on `evil.example.com.attacker.net` — a subdomain-based phishing vector.

Both are fixable in under 30 lines of code (see **Remediation** under each finding). Once remediated, the client-side cryptography is in the **"reasonable for a hackathon demo; acceptable baseline for a beta"** range.

The audit also notes **six Medium** and **seven Low/Informational** findings, most related to pre-alpha dependencies (Ika mock signer, Encrypt FHE fallback, Walrus testnet blob expiry), on-chain privacy leaks that are intentional design trade-offs, and missing defense-in-depth controls (rate limiting, CSP hardening).

**Verdict:** Suitable for hackathon submission and limited-beta testing after H-01 and H-02 are fixed. Not suitable for production storage of valuable credentials until (a) Ika MPC moves out of pre-alpha and (b) the items in the **Recommendations** section are addressed.

---

## Table of Contents

1. [Scope](#1-scope)
2. [Methodology](#2-methodology)
3. [Architecture Overview](#3-architecture-overview)
4. [Threat Model](#4-threat-model)
5. [Findings Summary](#5-findings-summary)
6. [Detailed Findings](#6-detailed-findings)
7. [Positive Observations](#7-positive-observations)
8. [Recommendations Roadmap](#8-recommendations-roadmap)
9. [Appendix A — Files Reviewed](#appendix-a--files-reviewed)
10. [Appendix B — Glossary](#appendix-b--glossary)
11. [Disclaimer](#disclaimer)

---

## 1. Scope

### In scope

| Component | Path | Lines |
|---|---|---|
| On-chain Anchor program | `programs/ikavault/src/**` | ~400 |
| Background service worker | `extension/src/background/index.ts` | 467 |
| Popup React views | `extension/src/popup/**` | ~900 |
| Content script | `extension/src/content/index.ts` | 208 |
| Crypto layer | `extension/src/lib/encryption.ts` | 205 |
| Solana client | `extension/src/lib/solana.ts` | 290 |
| Walrus client | `extension/src/lib/walrus.ts` | 72 |
| Encrypt FHE client | `extension/src/lib/encrypt.ts` | 161 |
| Web3Auth integration | `extension/src/lib/web3auth.ts` | 183 |
| Extension manifest | `extension/manifest.json` | 43 |

### Out of scope

- Third-party library internals (`@web3auth/modal`, `@solana/web3.js`, `anchor-lang`)
- Ika dWallet MPC protocol correctness (pre-alpha, mock signer by design)
- Encrypt FHE network cryptography (pre-alpha, plaintext fallback is in effect)
- Walrus blob-storage consensus / availability
- Solana runtime & consensus
- OS / browser kernel-level attacks
- Supply-chain attacks on `npm` dependencies beyond a surface-level manifest check

### Assumptions

- The user's Chrome browser is not compromised at the OS level.
- The user's Google account used for Web3Auth is not compromised *and* the Web3Auth Sapphire Devnet threshold network has not colluded with an attacker.
- Walrus testnet returns the same bytes that were uploaded (integrity of the blob content).
- The Solana devnet cluster is not under a 51 %-class attack.

---

## 2. Methodology

The audit was carried out as a **single-pass manual review** over the entire scope, supplemented by:

- Static reading of all source files listed in scope.
- Dynamic trace of the three critical flows — PIN setup, save credential, autofill — from UI entry point to final byte on-chain / on-Walrus.
- Cross-checking the off-chain Borsh serialization in `extension/src/lib/solana.ts` against the on-chain account layout declared in `programs/ikavault/src/state.rs` and the instruction arg order in `instructions/*.rs`.
- Threat-modelling against the four primary adversary classes enumerated in §4.
- Verification that the deployed program ID exists and is executable on Solana devnet (`getAccountInfo` RPC call, confirmed `executable: true`).

The report uses the following severity classes:

| Severity | Criterion |
|---|---|
| **Critical** | Immediate credential compromise or funds loss with a single off-path action |
| **High** | Compromise achievable by a realistic attacker within the stated threat model |
| **Medium** | Weakens defense-in-depth or enables compromise under compound conditions |
| **Low** | Privacy, UX, or operational concern without direct credential risk |
| **Informational** | No immediate action, but worth tracking |

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│ Browser Extension (Manifest V3)                                 │
│  ┌─────────────┐   ┌──────────────────┐   ┌─────────────────┐   │
│  │   Popup     │◄─►│ Service Worker   │◄─►│ Content Script  │   │
│  │  (React)    │   │  (background)    │   │  (per-page)     │   │
│  └─────────────┘   └────────┬─────────┘   └─────────────────┘   │
│                             │                                    │
│                   ┌─────────┴──────────┐                         │
│                   ▼                    ▼                         │
│           chrome.storage.local   In-memory cache                 │
│        (encrypted key share,    (AES key, key share,             │
│         PIN verifier, salt)      signing keypair — cleared       │
│                                  on lock / 5-min idle)           │
└──────────────────────┬───────────────────┬──────────────────────┘
                       │                   │
         ┌─────────────┴──────┐  ┌─────────┴──────────────┐
         ▼                    ▼  ▼                        ▼
  ┌─────────────┐    ┌──────────────────┐        ┌────────────────┐
  │  Web3Auth   │    │   Solana Devnet  │        │  Walrus Testnet│
  │  (Sapphire  │    │  ┌────────────┐  │        │  (Staketab pub)│
  │  Devnet)    │    │  │  ikavault  │  │        │  Encrypted     │
  │  Google →   │    │  │  Anchor pgm│  │        │  credential    │
  │  ed25519    │    │  └────────────┘  │        │  blobs         │
  └─────────────┘    └──────────────────┘        └────────────────┘
```

### Data flow — save credential

1. User types label / URL / username / password in popup.
2. Background worker **encrypts** the `{ password, notes, version }` JSON with AES-256-GCM using a key derived from the in-memory key share (SHA-256-normalized to 256 bit).
3. Ciphertext (base64) is **uploaded to Walrus testnet** via `PUT /v1/blobs` → Walrus returns a blob ID.
4. The URL is hashed (SHA-256 of the normalized hostname), then either FHE-encrypted via `client.encrypt()` (ideal) or passed through as raw hash (current pre-alpha fallback).
5. An `add_entry` instruction is submitted to the on-chain program carrying `{label, url, username, encrypted_blob_id, encrypted_url_hash}`. The Anchor program creates a `VaultEntry` PDA and bumps `UserProfile.entry_count`.

### Data flow — autofill

1. Content script observes DOM and detects `<input type="password">` fields.
2. Content script asks the background worker for matching credentials via `GET_CREDENTIALS_FOR_URL`.
3. Background fetches the `UserProfile`, iterates `VaultEntry` PDAs, filters active entries, passes their `encrypted_url_hash` values through `searchPrivate()` (FHE or plaintext fallback).
4. If exactly one match, the background worker downloads the Walrus blob, decrypts with AES-GCM using the cached key share, and returns the plaintext password to the content script.
5. Content script injects the password into the DOM via a native-value setter and dispatches `input` / `change` events.

### Key derivation

```
Google-OAuth (Web3Auth Sapphire Devnet)
        │
        ▼
privKey (32 B ed25519 seed)
        │
        ├──► salt = SHA-256(privKey)                  stored in chrome.storage
        │
        ├──► Keypair.fromSeed(privKey[:32])           in-memory only (fee payer + signer)
        │
        │              PIN ──┐
        │                     ▼
        └──► PBKDF2-SHA256(PIN, salt, 100 000 iter) ► AES-256-GCM key
                                                      │
                                 ┌────────────────────┼──────────────┐
                                 ▼                    ▼              ▼
                       encrypt key share     encrypt privKey seed   decrypt on unlock
                       → stored base64       → stored base64
```

The **key share** itself is currently a mock 32-byte random value generated locally during PIN setup; in production, it would be replaced by the Ika dWallet DKG protocol output (2PC-MPC share held by the user + peer share on the Ika committee).

---

## 4. Threat Model

The audit evaluates the design against four adversary classes, ordered by difficulty of access:

### T1 — Passive network observer

Capabilities: Reads Solana devnet ledger, reads Walrus blobs by ID.
Goal: Obtain credential plaintexts.
Mitigations in place:
- Credentials are AES-256-GCM encrypted before Walrus upload — blob cannot be decrypted without the key share.
- Key share never leaves the device.
- On-chain data is pointer-only (blob IDs, URL, username, label). Plaintext password is never on-chain.
Residual risk: **Username + URL + label are plaintext on-chain** (accepted privacy trade-off, see L-01).

### T2 — Physical device access (unlocked user profile)

Capabilities: Can read `chrome.storage.local`, can read extension source.
Goal: Obtain credential plaintexts.
Mitigations in place:
- Key share is AES-GCM-encrypted at rest under a PIN-derived AES key.
- PBKDF2 with 100 000 iterations slows brute-force of the PIN.
- Auto-lock after 5 minutes of inactivity clears in-memory AES key.
**Defects identified:** H-01 (PIN verifier bypass) and M-01 (PBKDF2 iterations below 2023 OWASP recommendation).

### T3 — Google account compromise

Capabilities: Attacker gains full access to the victim's Google account.
Goal: Obtain credential plaintexts.
Behavior:
- Web3Auth will regenerate the *same* ed25519 privkey for the attacker (deterministic per Google account under Sapphire Devnet threshold scheme).
- Attacker gains the signing key (can forge Solana txs, e.g. soft-delete the victim's vault entries).
- Attacker **does not** obtain the PIN, therefore **cannot** derive the AES key, therefore **cannot** decrypt the Walrus blobs.
Mitigations in place: PIN separation from Web3Auth.
Residual risk: **The PIN is the last line of defense** — this is exactly why H-01 matters so much. If an attacker gets both Google and the device's `chrome.storage.local` (credentials re-used across a hijacked Chrome Sync), they get everything.

### T4 — Malicious web page (autofill target)

Capabilities: Executes arbitrary JavaScript on a page the user visits; the user's extension content script is active.
Goal: Phish credentials, trick autofill into filling a foreign login form.
Mitigations in place:
- Autofill is gated by `GET_CREDENTIALS_FOR_URL` which filters credentials by URL.
- Autofill only triggers on a *single* match (never ambiguous).
**Defect identified:** H-02 (substring-based URL matcher allows subdomain phishing).

---

## 5. Findings Summary

| ID | Severity | Title | Component |
|---|---|---|---|
| **H-01** | High | PIN verifier enables brute-force bypass of PBKDF2 | `encryption.ts` |
| **H-02** | High | Plaintext URL matcher allows subdomain phishing autofill | `encrypt.ts` |
| **M-01** | Medium | PBKDF2 iteration count below OWASP 2023 guidance (100 k vs. 600 k) | `encryption.ts` |
| **M-02** | Medium | Mock key share = single point of failure on device compromise | `background/index.ts` |
| **M-03** | Medium | Content script runs on `<all_urls>` with no per-site opt-out | `manifest.json` |
| **M-04** | Medium | No PIN attempt rate limiting or lockout | `background/index.ts` |
| **M-05** | Medium | Autofill password is visible to the target page's own JavaScript | `content/index.ts` |
| **M-06** | Medium | No CSP hardening beyond Chrome's Manifest V3 defaults | `manifest.json` |
| **L-01** | Low | `url`, `username`, `label` stored plaintext on-chain | `programs/.../state.rs` |
| **L-02** | Low | Soft-deleted Walrus blobs remain readable until epoch expiry | architectural |
| **L-03** | Low | `skipPreflight: false` is good, but no client-side simulation before user tx | `solana.ts` |
| **L-04** | Low | `deserializeVaultEntry` silently returns `null` on any parse error | `solana.ts` |
| **I-01** | Info | Ika dWallet mock signer (documented, pre-alpha) | architecture |
| **I-02** | Info | Encrypt FHE falls back to plaintext hash (documented, pre-alpha) | `encrypt.ts` |
| **I-03** | Info | Solana devnet periodically wipes state (per Ika pre-alpha docs) | operational |
| **I-04** | Info | Walrus testnet blobs expire after 3 epochs | `walrus.ts` |
| **I-05** | Info | Web3Auth Client ID in `.env` — not a secret, but worth documenting | `.env` |
| **I-06** | Info | Anchor integration tests (`tests/ikavault.ts`) not verified in this audit | `tests/` |

---

## 6. Detailed Findings

### H-01 — PIN verifier enables brute-force bypass of PBKDF2

**Location:** `extension/src/lib/encryption.ts` lines 65–73, stored via `background/index.ts` lines 151–160.

**Description**

At PIN setup, the extension computes and persists a **PIN verifier** alongside the encrypted key share:

```ts
// encryption.ts:65
export async function computePinVerifier(pin: string, saltB64: string): Promise<string> {
  const pinBytes = new TextEncoder().encode(pin);
  const saltBytes = base64ToBytes(saltB64);
  const combined = new Uint8Array(pinBytes.length + saltBytes.length);
  combined.set(pinBytes, 0);
  combined.set(saltBytes, pinBytes.length);
  const hash = await crypto.subtle.digest("SHA-256", combined);
  return bytesToBase64(new Uint8Array(hash));
}
```

Stored fields in `chrome.storage.local` per user:

```ts
interface VaultKeyStore {
  dwalletId: string;
  encryptedKeyShareB64: string;
  encryptedPrivKeyB64: string;
  saltB64: string;            // SHA-256(privKey)
  pbkdf2Iterations: 100_000;
  pinVerifierB64: string;     // SHA-256(PIN || salt)  ◄─── the problem
}
```

The stated goal of PBKDF2 with 100 000 iterations is to **slow brute-force of the PIN** by a factor of 100 000 compared to a single hash.

However, an attacker with read access to `chrome.storage.local` (threat model T2, T3-with-device-access) does not need to run PBKDF2 at all. They can brute-force the PIN against the *verifier* at raw SHA-256 speed, which is **five to six orders of magnitude faster** than PBKDF2-100k.

**Concrete attack**

Assume a 4-digit PIN (the default length implied by `PinSetupView`):

| Path | Work to brute-force full PIN space (10⁴) |
|---|---|
| Against PBKDF2-100k (intended barrier) | 10⁴ × 100 000 = **10⁹ SHA-256 rounds** |
| Against PIN verifier (actual barrier) | 10⁴ × 1 = **10⁴ SHA-256 rounds** |

On commodity hardware, the verifier path completes in **under one millisecond**. Even an 8-digit PIN finishes in under a second.

Once the attacker recovers the PIN via the verifier, they derive the AES key with a *single* legitimate PBKDF2 run, decrypt `encryptedKeyShareB64` and `encryptedPrivKeyB64`, and hold full vault capability (decrypt any Walrus blob, forge Solana transactions as the user).

**Impact**

Complete compromise of vault confidentiality **and** integrity in threat model T2 (device access) and T3 (Google + device). The 100 000 PBKDF2 iterations provide no protection against an attacker who reads the storage.

**Recommendation (Remediation)**

Delete the verifier entirely. Use the AES-GCM authentication tag as the verifier — a wrong PIN derives a wrong AES key, and the GCM decrypt throws. This is the standard pattern for password-based encryption.

Concrete change in `background/index.ts`:

```ts
// Before (handleUnlockVault):
const verifier = await computePinVerifier(pin, store.saltB64);
if (verifier !== store.pinVerifierB64) return null;
const aesKey = await deriveKeyFromPin(pin, store.saltB64);
const keyShare = await decryptKeyShare(store.encryptedKeyShareB64, aesKey); // throws on wrong PIN

// After:
const aesKey = await deriveKeyFromPin(pin, store.saltB64);
let keyShare: DWalletKeyShare;
try {
  keyShare = await decryptKeyShare(store.encryptedKeyShareB64, aesKey);
} catch {
  return null;  // wrong PIN → AES-GCM tag mismatch
}
```

Remove `pinVerifierB64` from `VaultKeyStore`, `computePinVerifier`, and all call sites. This restores the 100 000 PBKDF2 barrier to its intended role.

**Status:** OPEN.

---

### H-02 — Plaintext URL matcher allows subdomain phishing autofill

**Location:** `extension/src/lib/encrypt.ts` lines 154–160.

**Description**

When the Encrypt FHE gRPC endpoint is unavailable (which is **always** in pre-alpha), URL matching falls back to the plaintext matcher:

```ts
// encrypt.ts:154
export function plaintextSearch(storedUrls: string[], queryUrl: string): number[] {
  const queryNorm = normalizeUrl(queryUrl);
  return storedUrls
    .map((url, i) => ({ i, norm: normalizeUrl(url) }))
    .filter(({ norm }) =>
      norm === queryNorm || norm.includes(queryNorm) || queryNorm.includes(norm)
    )
    .map(({ i }) => i);
}
```

`normalizeUrl` reduces each URL to `hostname` without the `www.` prefix. The matcher then accepts *any* substring containment. Combined with the content script's auto-fill behavior on a single match (`content/index.ts:151`), this produces the following attack:

**Concrete attack — subdomain phishing**

1. Victim saves credential for `example.com`.
2. Attacker lures the victim to `evil.example.com.attacker.net` (or `example.com.attacker.net`).
3. Content script calls `GET_CREDENTIALS_FOR_URL` with `url = "https://example.com.attacker.net/login"`.
4. `normalizeUrl` returns `example.com.attacker.net`.
5. Matcher checks `"example.com.attacker.net".includes("example.com")` → **true**.
6. Single match → autofill fires → password is injected into a DOM field on `attacker.net`.
7. Page JavaScript on `attacker.net` now reads `input.value` and exfiltrates the password.

**Reverse direction (also exploitable):** victim has a credential for `checkout.example.com`; attacker routes them to `example.com`. Normalized query (`example.com`) is contained in stored (`checkout.example.com`), matcher returns it.

**Impact**

Subdomain-based phishing autofill. An attacker who can serve content at *any* domain containing the victim's stored hostname as a substring receives the decrypted password. Severity is High because:
- It requires only a realistic phishing scenario.
- No user confirmation is required (single-match auto-fills).
- The FHE fallback is active for every current user of the extension.

**Recommendation (Remediation)**

1. Replace substring matching with **exact eTLD+1 match** using the Public Suffix List. Recommended library: `psl` (~40 KB).
2. Alternatively, for a zero-dependency fix, require `storedNorm === queryNorm` (strict equality after normalization). This is correct for 95 % of real-world cases; edge cases (cross-subdomain SSO) can be handled with an explicit user-visible "also match subdomains" toggle per entry.
3. Add a user-confirmation step in `content/index.ts` before auto-filling, showing the matched stored hostname vs. the current page hostname.

Concrete change:

```ts
// encrypt.ts
export function plaintextSearch(storedUrls: string[], queryUrl: string): number[] {
  const queryNorm = normalizeUrl(queryUrl);
  return storedUrls
    .map((url, i) => ({ i, norm: normalizeUrl(url) }))
    .filter(({ norm }) => norm === queryNorm)
    .map(({ i }) => i);
}
```

**Status:** OPEN.

---

### M-01 — PBKDF2 iteration count below OWASP 2023 guidance

**Location:** `extension/src/lib/encryption.ts` line 16.

**Description**

```ts
const PBKDF2_ITERATIONS = 100_000;
```

OWASP's [Password Storage Cheat Sheet (2023)](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) recommends **600 000** iterations for PBKDF2-SHA256. The current value was likely chosen in 2020 and not updated.

**Impact**

Once H-01 is remediated (attacker must actually go through PBKDF2), the attacker's cost to brute-force a 4-digit PIN is reduced 6× compared to the modern guidance. For a 4-digit PIN, this is the difference between ~10 seconds and ~1 minute on a single GPU — still trivially brute-forceable.

The root cause is the **small PIN space**, not the PBKDF2 count. A 4-digit PIN has only 10 000 entries; even 10⁷ iterations only raises the cost to ~10¹¹ hashes, feasible on a modest GPU farm in under an hour.

**Recommendation**

1. Raise `PBKDF2_ITERATIONS` to **600 000** (one-line change).
2. Consider migrating to `argon2id` (via WebAssembly; e.g. `hash-wasm`) — the modern standard for memory-hard password hashing. This is the single most impactful change for password-manager security.
3. **Enforce minimum PIN length of 6 digits**, preferably longer, and allow alphanumeric PINs. A 6-digit numeric PIN has 10⁶ entries × 600k iter = 6·10¹¹ hashes, ~10 minutes on a GPU. An 8-char alphanumeric PIN has 62⁸ ≈ 2·10¹⁴ entries, infeasible.

**Status:** OPEN.

---

### M-02 — Mock key share is a single point of failure on device compromise

**Location:** `extension/src/background/index.ts` lines 131–138.

**Description**

```ts
// background/index.ts:131
const rawShare = new Uint8Array(32);
crypto.getRandomValues(rawShare);
const keyShare: DWalletKeyShare = {
  dwalletId: `mock_${publicKey.slice(0, 8)}`,
  keyShareB64: btoa(String.fromCharCode(...rawShare)),
};
```

The current implementation uses a locally generated 32-byte random value as the "key share". In the intended production design (Ika 2PC-MPC), the key share would be one half of a split key, with the other half held on the Ika committee — such that neither side alone can decrypt.

Currently, an attacker who reads `chrome.storage.local` and brute-forces the PIN (see H-01, M-01) has **full decryption capability**. The dWallet layer provides zero additional protection.

**Impact**

This is the central architectural distinction IkaVault claims over its competitors (Lockbox, Keyra, Genesis, SolPass per CLAUDE.md). Until Ika MPC moves out of pre-alpha, that distinction does not hold in practice. This should be disclosed transparently in the hackathon submission and README.

**Recommendation**

1. Document clearly in user-facing README and demo that the current build uses mock keyshares pending Ika MPC production.
2. Track the Ika pre-alpha → beta → GA transition and wire the real DKG flow as soon as the SDK supports it.
3. As a short-term mitigation, consider deriving the key share from a **hardware-backed WebAuthn credential** (platform authenticator), requiring a biometric per decrypt. This provides a real "second factor" even pre-MPC.

**Status:** ACCEPTED (hackathon context), tracked for production.

---

### M-03 — Content script runs on `<all_urls>` with no per-site opt-out

**Location:** `extension/manifest.json` line 25.

```json
"content_scripts": [{
  "matches": ["<all_urls>"],
  "js": ["content.js"],
  "run_at": "document_idle"
}]
```

**Description**

The content script is injected into every page the user visits, including sensitive pages (banking, internal corporate sites). While the script does not currently exfiltrate data, the **attack surface is every page**. Any future bug in the content script (e.g. prototype pollution, `innerHTML` injection in the autofill button) becomes a universal XSS.

The script also calls `sessionStorage.setItem("ikavault_pubkey", ...)` on every page, leaking the user's Solana public key to the page's origin (any script on the page can read it).

**Impact**

- The Solana public key is semi-public (it's on the ledger), but revealing it to arbitrary sites enables tracking / linkage.
- Any latent bug in `content/index.ts` has a blast radius of **every page the user visits**.

**Recommendation**

1. Scope `matches` to login-like pages via `activeTab` + programmatic injection on user action (click the extension icon). This requires UX changes.
2. Move `pubkey` out of `sessionStorage` and fetch it from the background worker only at autofill time.
3. Add a `world: "ISOLATED"` attribute (already default in MV3) explicitly; verify no exposure to `MAIN` world. Currently OK.

**Status:** OPEN.

---

### M-04 — No PIN attempt rate limiting or lockout

**Location:** `extension/src/background/index.ts` `handleVerifyPin`, `handleUnlockVault`.

**Description**

`handleVerifyPin` and `handleUnlockVault` do not track consecutive failures, do not introduce a back-off, and do not lock the vault after N failed attempts. An attacker with a script-injection foothold (e.g., compromised popup page via a future CSP bypass) can fire 10 000 PIN guesses per second against `chrome.runtime.sendMessage({ type: "VERIFY_PIN", ... })`.

Combined with H-01 (which makes offline brute-force trivial anyway), this is currently less impactful than it would be in a properly-hardened build. Post-H-01-remediation, this finding becomes the main brute-force vector.

**Recommendation**

Add exponential back-off in `background/index.ts`:

```ts
let failedAttempts = 0;
let lockoutUntil = 0;

async function handleVerifyPin(payload) {
  if (Date.now() < lockoutUntil) {
    return { success: false, error: "LOCKED_OUT" };
  }
  const result = await verifyPinInternal(payload);
  if (!result) {
    failedAttempts += 1;
    if (failedAttempts >= 5) {
      lockoutUntil = Date.now() + 2 ** (failedAttempts - 5) * 1000; // 1s, 2s, 4s, ...
    }
  } else {
    failedAttempts = 0;
  }
  return result;
}
```

Persist `failedAttempts` in `chrome.storage.local` so it survives service worker restarts.

**Status:** OPEN.

---

### M-05 — Autofill exposes password to the target page's own JavaScript

**Location:** `extension/src/content/index.ts` lines 165–177.

**Description**

```ts
function autofill(username: string, password: string) {
  const passwordInput = document.querySelector<HTMLInputElement>('input[type="password"]');
  // ...
  fillInput(passwordInput, password);
  // ...
}
```

Once the password is written via `nativeInputValueSetter` and an `input` event is dispatched, any script on the page can read `passwordInput.value`. This is **inherent to browser autofill** and applies to all password managers, but is worth stating.

**Impact**

If the user autofills on a page that is compromised (XSS, malicious third-party script), the password leaks.

**Recommendation**

1. Before calling `autofill`, require an explicit user gesture in a trusted popup UI (not just the injected button). The current flow has this partially — the button is user-clicked — but enabling "single-match auto-autofill without user click" in the future should be avoided.
2. Consider adding a prominent "last-used on domain X" display in the popup, so the user notices if the domain changed.

**Status:** ACCEPTED (industry-standard trade-off).

---

### M-06 — No CSP hardening beyond Manifest V3 defaults

**Location:** `extension/manifest.json` lines 39–41.

```json
"content_security_policy": {
  "extension_pages": "script-src 'self'; object-src 'self'"
}
```

**Description**

The CSP for extension pages allows `'self'` for `script-src` and `object-src`, and implicitly `*` for everything else (`connect-src`, `img-src`, `style-src`, etc.). The extension currently connects to:

- `api.devnet.solana.com` (Solana RPC)
- `publisher.walrus-testnet.walrus.space`, `aggregator.walrus-testnet.walrus.space` (Walrus)
- Web3Auth's endpoints

Not whitelisting these in `connect-src` means if a future bug allows arbitrary outbound fetches, they would succeed.

**Recommendation**

Add explicit `connect-src` whitelist:

```json
"content_security_policy": {
  "extension_pages": "script-src 'self'; object-src 'self'; connect-src 'self' https://api.devnet.solana.com https://*.walrus-testnet.walrus.space https://*.web3auth.io https://*.ika-network.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;"
}
```

**Status:** OPEN.

---

### L-01 — `url`, `username`, `label` stored plaintext on-chain

**Location:** `programs/ikavault/src/state.rs` lines 63–75.

**Description**

The `VaultEntry` account stores `label`, `url`, `username` as plaintext fields. Any observer of the Solana ledger can enumerate which sites the user has credentials for.

**Impact**

Privacy leak. Link-ability: "this wallet has Gmail, Twitter, 1password.com credentials" is public knowledge.

**Recommendation**

This is an explicit design trade-off (fast autofill matching without off-chain queries). If privacy is prioritized later:

- Store only `encrypted_url_hash` and `encrypted_username` on-chain.
- Fetch an encrypted index blob from Walrus for display names (labels).
- The Encrypt FHE integration (once out of pre-alpha) makes URL matching private without revealing the URL.

**Status:** ACCEPTED (current design) — track for post-pre-alpha Encrypt integration.

---

### L-02 — Soft-deleted Walrus blobs remain readable until epoch expiry

**Location:** `programs/ikavault/src/instructions/delete_entry.rs` line 38.

**Description**

Deletion sets `is_active = false` on-chain but does not instruct Walrus to delete the blob. Walrus testnet blobs expire after 3 epochs (~2 weeks); until then, anyone with the blob ID can still download the ciphertext.

**Impact**

If the encryption key is ever compromised (e.g., a future H-01-style weakness), "deleted" credentials are still decryptable from Walrus. The on-chain `delete_entry` soft-delete only hides them in the UI.

**Recommendation**

1. On delete, additionally call `uploadEncryptedCredential` with a zero-byte payload under the *same* blob ID (Walrus deduplication) — no, Walrus content-addresses blobs, so a new payload gets a new ID. The old blob still exists.
2. True remedy: instruct user that "delete" is a soft-delete; for a hard-delete, they must rotate the master key (re-encrypt all remaining entries under a new key share and regenerate the vault).

**Status:** ACCEPTED.

---

### L-03 — No client-side simulation before user transaction

**Location:** `extension/src/lib/solana.ts` `sendIx`.

**Description**

`sendRawTransaction` is called with `skipPreflight: false`, which is good — the cluster does a simulation. But no **client-side** `connection.simulateTransaction` is run before requesting the user's signature. The tx is signed by the cached keypair automatically, without user confirmation.

**Impact**

Low in the current design (the keypair is derived from Web3Auth, the popup flow is the only trigger). But if ever exposed to a content-script-initiated transaction path, a silent signature with no simulation could cost SOL on a failed tx.

**Recommendation**

Add a `simulateTransaction` call for informational feedback in DEBUG builds; production build can skip.

**Status:** INFORMATIONAL / OPEN.

---

### L-04 — `deserializeVaultEntry` silently returns `null` on any parse error

**Location:** `extension/src/lib/solana.ts` lines 258–289.

**Description**

The whole deserialization is wrapped in `try { ... } catch { return null; }`. If the on-chain layout ever changes (e.g., Anchor adds a new field), all entries silently disappear from the UI with no error logged.

**Recommendation**

Log the parse error (`console.warn("vault entry %d failed to deserialize: %o", index, err)`) to aid debugging. Don't swallow.

**Status:** OPEN.

---

### I-01 — Ika dWallet mock signer (pre-alpha)

Per `CLAUDE.md`, the Ika Solana SDK is pre-alpha with a single mock signer — no real MPC. Already transparently documented in the codebase comments (`encryption.ts:12`, `background/index.ts:131`). Flagged for tracking.

### I-02 — Encrypt FHE falls back to plaintext hash (pre-alpha)

The `@encrypt.xyz/pre-alpha-solana-client` package is not on npm; `encrypt.ts:39` gracefully degrades to raw SHA-256 hash. When Encrypt mainnet launches, the fallback drops and real FHE matching activates.

### I-03 — Devnet periodically wipes state

Per Ika pre-alpha docs, all on-chain data will be wiped periodically. Users must redo PIN setup and re-save all credentials after a wipe. UX note for hackathon demo.

### I-04 — Walrus testnet blobs expire after 3 epochs

`walrus.ts:5`: `DEFAULT_EPOCHS = 3`. Users need to either (a) re-upload before expiry or (b) migrate to Walrus mainnet for persistent storage.

### I-05 — Web3Auth Client ID in `extension/.env`

Not a secret — Web3Auth Client IDs are public identifiers. Whitelist controls access. However, some developers mistakenly treat them as secrets; worth clarifying in a README.

### I-06 — Anchor integration tests (`tests/ikavault.ts`) not verified

The `tests/` directory was not executed as part of this audit. A `anchor test` run is recommended before each release to catch on-chain layout regressions.

---

## 7. Positive Observations

Several design and implementation choices are **good** and worth calling out as positive findings:

1. **AES-256-GCM with unique random 12-byte nonces** everywhere. Nonces are prepended to the ciphertext and read back correctly. No nonce reuse vectors observed.
2. **`has_one = owner`** constraints are correctly applied on `user_profile`, `vault_entry` in `add_entry.rs`, `update_entry.rs`, `delete_entry.rs`. Cross-user writes are prevented at the Anchor level.
3. **PDA seeds include the owner's pubkey**, making cross-user PDA collision impossible.
4. **Key share never touches disk in plaintext.** All persistence is through AES-GCM.
5. **Auto-lock after 5 minutes** clears the in-memory AES key, keyshare, and Keypair — minimizing the window in which a malicious local process could steal them.
6. **The manual Borsh serialization** in `solana.ts` was a deliberate trade-off to bypass the Anchor `Program` wrapper's MV3 service-worker incompatibility (documented in `devlog_2026-04-16.md`). The manual path is auditable in ~30 lines, each instruction's account metas were cross-checked against the program's `#[derive(Accounts)]` blocks — they match.
7. **Discriminator values** in `solana.ts` (`DISC_INIT_VAULT`, `DISC_ADD_ENTRY`, `DISC_DELETE_ENTRY`) match Anchor's `sha256("global:<ix_name>")[..8]` derivation for the corresponding program IDs.
8. **Content script respects `data-ikavault-injected`** to avoid re-injecting the autofill button on DOM mutations.
9. **`normalizeUrl`** strips `www.` and lowercases — reasonable normalization.
10. **Service-worker kill-and-respawn** (the 30-second Chrome MV3 sleep) is handled with a `VAULT_LOCKED` error + popup-side redirect to PIN entry (documented in `devlog_2026-04-16.md`). Good MV3 awareness.
11. **Error paths do not leak information.** "Wrong PIN" is generic; no timing-based disclosures observed.

---

## 8. Recommendations Roadmap

### Must-fix before any production use

1. **Remediate H-01** (remove PIN verifier). ~15 LOC change.
2. **Remediate H-02** (strict URL matching). ~5 LOC change.

### Should-fix before public beta

3. Raise PBKDF2 to 600 000 iterations (M-01). 1 LOC.
4. Enforce 6-digit minimum PIN or alphanumeric PINs (M-01).
5. Add PIN attempt rate limiting (M-04). ~20 LOC.
6. Tighten CSP with explicit `connect-src` whitelist (M-06). 1 JSON line.
7. Log deserialization errors (L-04). 1 LOC.

### Should-fix before production / GA

8. Migrate PIN hashing to **argon2id** via `hash-wasm` (M-01).
9. Switch from `<all_urls>` content script to activeTab + programmatic injection (M-03).
10. Wire real Ika 2PC-MPC key share once SDK supports it (M-02).
11. Activate real Encrypt FHE URL matching and remove plaintext fallback entirely (I-02, which auto-resolves H-02 also).
12. Encrypt `url`, `username`, `label` on-chain once FHE makes it feasible (L-01).
13. Implement true hard-delete flow via key rotation (L-02).
14. Add a user-visible "confirmed autofill target" indicator (M-05).
15. Add WebAuthn / platform authenticator as an additional PIN factor (M-02).

### Nice to have

16. Cap `MAX_VAULT_ENTRIES` to a reasonable limit (currently 256) — or implement paging.
17. Provide a vault export / encrypted backup flow that uses a fresh random key (not the cached key share).
18. Add a settings UI exposing auto-lock duration, PIN change, and "delete all data" workflows.

---

## Appendix A — Files Reviewed

```
programs/ikavault/src/lib.rs
programs/ikavault/src/state.rs
programs/ikavault/src/errors.rs
programs/ikavault/src/instructions/mod.rs
programs/ikavault/src/instructions/init_vault.rs
programs/ikavault/src/instructions/add_entry.rs
programs/ikavault/src/instructions/update_entry.rs
programs/ikavault/src/instructions/delete_entry.rs
programs/ikavault/src/instructions/share_entry.rs    (not fully reviewed — stretch goal)
extension/manifest.json
extension/.env                                        (content noted, non-secret)
extension/src/background/index.ts
extension/src/content/index.ts
extension/src/lib/encryption.ts
extension/src/lib/solana.ts
extension/src/lib/walrus.ts
extension/src/lib/encrypt.ts
extension/src/lib/web3auth.ts
extension/src/lib/messaging.ts
extension/src/lib/types.ts
extension/src/popup/App.tsx
extension/src/popup/index.tsx
extension/src/popup/views/LoginView.tsx
extension/src/popup/views/PinSetupView.tsx
extension/src/popup/views/PinUnlockView.tsx
extension/src/popup/views/VaultView.tsx
extension/src/popup/views/AddEntryView.tsx
extension/src/popup/views/EntryDetailView.tsx
```

---

## Appendix B — Glossary

| Term | Meaning in this report |
|---|---|
| **AES-GCM** | Authenticated symmetric encryption used throughout the extension for credential and key-share confidentiality + integrity |
| **PBKDF2** | Password-Based Key Derivation Function 2. Used to derive the AES key from the user's PIN + salt |
| **PDA** | Program-Derived Address; a Solana account whose address is deterministically computed from seeds + program ID, and which can only be signed by the program |
| **2PC-MPC** | 2-Party Computation Multi-Party Computation — Ika's split-key custody primitive where neither party alone can produce a signature or decrypt |
| **dWallet** | Ika's user-facing name for a 2PC-MPC key pair |
| **Walrus** | Decentralized blob-storage network from Mysten; IkaVault uses its testnet publisher/aggregator HTTP endpoints |
| **FHE** | Fully Homomorphic Encryption. Encrypt's planned primitive for private URL-hash matching on-chain |
| **Web3Auth (MetaMask Embedded Wallets)** | Sapphire Devnet threshold key network that converts a Google OAuth identity into a deterministic ed25519 private key |
| **MV3** | Chrome Manifest V3 — the current extension platform; service-worker-based background, stricter CSP than MV2 |
| **Service worker** | The persistent-capable background page of an MV3 extension; Chrome may terminate it after ~30 s of inactivity |

---

## Disclaimer

This audit represents a **single-auditor, point-in-time review** of the codebase at the state noted above. It is not a formal verification, not a penetration test, and does not constitute a guarantee against all possible vulnerabilities. The audit focuses on the cryptographic, on-chain-program, and browser-extension security surfaces. It does **not** cover:

- Third-party package supply-chain compromise
- Physical-side-channel attacks (power, electromagnetic, acoustic)
- Vulnerabilities in the underlying operating system, browser, or hardware
- Social-engineering attacks against the end user
- Attacks on the Ika MPC committee, Walrus storage nodes, or Solana validators
- Long-term cryptographic concerns (quantum)

Remediation status of findings should be re-assessed before any public-beta or production deployment. A full second-pass audit is recommended after the "Must-fix" and "Should-fix before public beta" items are addressed.

*— end of report —*
