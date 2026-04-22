/// IkaVault background service worker.
///
/// Security model: PIN + SHA-256(Web3Auth_privkey) → PBKDF2 → AES-256-GCM
/// The key share is NEVER stored plaintext — always encrypted with the PIN-derived key.
/// In-memory AES key is cleared on lock or after AUTO_LOCK_MS of inactivity.

import type { ExtensionMessage, ExtensionResponse, VaultEntry, DWalletKeyShare, VaultKeyStore } from "../lib/types";
import {
  computeSaltFromPrivKey,
  deriveKeyFromPin,
  encryptKeyShare,
  decryptKeyShare,
  encryptCredential,
  decryptCredential,
  base64ToBytes,
  bytesToBase64,
} from "../lib/encryption";
import { PublicKey, Keypair } from "@solana/web3.js";
import {
  fetchUserProfile,
  fetchVaultEntries,
  initVault,
  addEntry,
  deleteEntry,
  connection,
} from "../lib/solana";
import { uploadEncryptedCredential, downloadEncryptedCredential } from "../lib/walrus";
import { encryptUrlHash, searchPrivate } from "../lib/encrypt";

// ─── In-memory state (cleared on lock) ───────────────────────────────────────

// Keypair derived from Web3Auth private key, used for on-chain signing
let cachedKeypair: Keypair | null = null;
// Decrypted AES key, held in memory while vault is unlocked
let cachedAesKey: CryptoKey | null = null;
// Decrypted key share, held in memory while vault is unlocked
let cachedKeyShare: DWalletKeyShare | null = null;

const AUTO_LOCK_MS = 5 * 60 * 1000; // 5 minutes inactivity
let autoLockTimer: ReturnType<typeof setTimeout> | null = null;

function resetAutoLock() {
  if (autoLockTimer) clearTimeout(autoLockTimer);
  autoLockTimer = setTimeout(lockVault, AUTO_LOCK_MS);
}

function lockVault() {
  cachedAesKey = null;
  cachedKeyShare = null;
  cachedKeypair = null;
  if (autoLockTimer) { clearTimeout(autoLockTimer); autoLockTimer = null; }
  console.log("IkaVault: vault locked");
}

// ─── Message dispatcher ───────────────────────────────────────────────────────

type Handler = (payload: unknown) => Promise<ExtensionResponse>;

const handlers: Record<string, Handler> = {
  INIT_VAULT: handleInitVault,
  SETUP_PIN: handleSetupPin,
  VERIFY_PIN: handleVerifyPin,
  HAS_PIN: handleHasPin,
  LOCK_VAULT: handleLockVault,
  UNLOCK_VAULT: handleUnlockVault,
  LOGOUT: handleLogout,
  GET_USER_PROFILE: handleGetUserProfile,
  SAVE_CREDENTIAL: handleSaveCredential,
  DECRYPT_CREDENTIAL: handleDecryptCredential,
  DELETE_CREDENTIAL: handleDeleteCredential,
  GET_CREDENTIALS_FOR_URL: handleGetCredentialsForUrl,
};

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse) => {
    const handler = handlers[message.type];
    if (!handler) {
      sendResponse({ success: false, error: `Unknown message type: ${message.type}` });
      return false;
    }

    handler(message.payload)
      .then(sendResponse)
      .catch((err: unknown) => {
        console.error(`Handler ${message.type} failed:`, err);
        sendResponse({
          success: false,
          error: err instanceof Error ? err.message : String(err),
        });
      });

    return true;
  }
);

// ─── Vault init (called right after Google login, before PIN setup) ───────────

async function handleInitVault(payload: unknown): Promise<ExtensionResponse> {
  const { publicKey } = payload as { publicKey: string };
  try {
    await maybeInitVault(publicKey);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── PIN setup ────────────────────────────────────────────────────────────────

/**
 * Called once after Google login, when user sets their PIN for the first time.
 * Receives the Web3Auth private key (hex) from the popup (only popup has window).
 *
 * Flow:
 *  1. Generate random key share (mock; real: Ika dWallet DKG)
 *  2. Compute salt = SHA-256(privkey)
 *  3. Derive AES key = PBKDF2(PIN, salt, 100k)
 *  4. Encrypt key share with AES key
 *  5. Store { encryptedKeyShare, salt, pinVerifier } in chrome.storage
 *  6. Cache AES key + key share in memory (vault is unlocked immediately)
 */
async function handleSetupPin(payload: unknown): Promise<ExtensionResponse> {
  const { publicKey, pin, privKeyB64 } = payload as {
    publicKey: string;
    pin: string;
    privKeyB64: string; // base64 Web3Auth private key, retrieved in popup context
  };

  try {
    // 1. Generate mock key share (real: call Ika gRPC DKG here)
    const rawShare = new Uint8Array(32);
    crypto.getRandomValues(rawShare);
    const keyShare: DWalletKeyShare = {
      dwalletId: `mock_${publicKey.slice(0, 8)}`,
      keyShareB64: btoa(String.fromCharCode(...rawShare)),
    };

    // 2. Salt from privkey hash
    const saltB64 = await computeSaltFromPrivKey(privKeyB64);

    // 3. Derive AES key
    const aesKey = await deriveKeyFromPin(pin, saltB64);

    // 4. Encrypt key share + private key seed
    //    Wrong PIN → derives wrong AES key → AES-GCM tag fails on unlock. That
    //    authentication tag IS the PIN verifier — storing a separate SHA-256(PIN)
    //    would let an attacker with storage access brute-force at raw SHA speed
    //    (bypassing the PBKDF2 barrier). See AUDIT.md / H-01.
    const encryptedKeyShareB64 = await encryptKeyShare(keyShare, aesKey);
    const privKeySeed = base64ToBytes(privKeyB64).slice(0, 32);
    const encryptedPrivKeyB64 = await encryptRaw(privKeySeed, aesKey);

    const store: VaultKeyStore = {
      dwalletId: keyShare.dwalletId,
      encryptedKeyShareB64,
      encryptedPrivKeyB64,
      saltB64,
      pbkdf2Iterations: 100_000,
    };

    await chrome.storage.local.set({ [`vaultKey_${publicKey}`]: store });

    // 6. Cache in memory — vault unlocked immediately after setup
    cachedAesKey = aesKey;
    cachedKeyShare = keyShare;
    cachedKeypair = Keypair.fromSeed(privKeySeed);
    resetAutoLock();

    // Initialize on-chain vault
    await maybeInitVaultWithKeyShare(publicKey, keyShare);

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── PIN verify / unlock ──────────────────────────────────────────────────────

/**
 * Unlock the vault with a PIN. Derives the AES key, decrypts the key share,
 * caches both in memory, starts the auto-lock timer.
 */
async function handleUnlockVault(payload: unknown): Promise<ExtensionResponse> {
  const { publicKey, pin } = payload as { publicKey: string; pin: string };
  try {
    const keyShare = await unlockWithPin(publicKey, pin);
    if (!keyShare) {
      return { success: false, error: "Wrong PIN" };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * PIN verification via AES-GCM authentication tag.
 * Wrong PIN → wrong AES key → tag mismatch → decrypt throws. That failure IS
 * the verifier — no separate hash stored. See AUDIT.md / H-01.
 */
async function handleVerifyPin(payload: unknown): Promise<ExtensionResponse<{ valid: boolean }>> {
  const { publicKey, pin } = payload as { publicKey: string; pin: string };
  try {
    const store = await getVaultKeyStore(publicKey);
    if (!store) return { success: true, data: { valid: false } };

    const aesKey = await deriveKeyFromPin(pin, store.saltB64);
    try {
      await decryptKeyShare(store.encryptedKeyShareB64, aesKey);
      return { success: true, data: { valid: true } };
    } catch {
      return { success: true, data: { valid: false } };
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function handleLockVault(_payload: unknown): Promise<ExtensionResponse> {
  lockVault();
  return { success: true };
}

/** Returns whether a PIN has been set up for this public key. */
async function handleHasPin(payload: unknown): Promise<ExtensionResponse<{ hasPin: boolean }>> {
  const { publicKey } = payload as { publicKey: string };
  const store = await getVaultKeyStore(publicKey);
  return { success: true, data: { hasPin: !!store } };
}

// ─── Logout ───────────────────────────────────────────────────────────────────

async function handleLogout(_payload: unknown): Promise<ExtensionResponse> {
  try {
    lockVault();
    
    await chrome.storage.local.remove("authState");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Vault data handlers ──────────────────────────────────────────────────────

async function handleGetUserProfile(
  payload: unknown
): Promise<ExtensionResponse<{ entries: VaultEntry[] }>> {
  const { publicKey } = payload as { publicKey: string };

  try {
    const ownerKey = new PublicKey(publicKey);
    const profile = await fetchUserProfile(ownerKey);

    if (!profile) {
      return { success: true, data: { entries: [] } };
    }

    const entries = await fetchVaultEntries(ownerKey, profile.entryCount);
    return { success: true, data: { entries } };
  } catch (err) {
    console.error("fetchUserProfile failed:", err);
    return { success: true, data: { entries: [] } };
  }
}

async function handleSaveCredential(payload: unknown): Promise<ExtensionResponse<VaultEntry>> {
  const { publicKey, label, url, username, password, notes } = payload as {
    publicKey: string;
    label: string;
    url: string;
    username: string;
    password: string;
    notes?: string;
  };

  try {
    // Vault must be unlocked
    const { keyShare, keypair } = await requireUnlocked(publicKey);

    const encryptedB64 = await encryptCredential({ password, notes, version: 1 }, keyShare);
    const blobId = await uploadEncryptedCredential(encryptedB64);

    // Encrypt FHE: encrypt URL hash for private autofill matching
    const encryptedUrlHash = await encryptUrlHash(url);

    const ownerKey = new PublicKey(publicKey);

    const profile = await fetchUserProfile(ownerKey);
    const entryIndex = profile?.entryCount ?? 0;

    await addEntry(ownerKey, keypair, {
      label, url, username, encryptedBlobId: blobId, entryIndex,
      encryptedUrlHash: Array.from(encryptedUrlHash),
    });

    resetAutoLock();

    const now = Math.floor(Date.now() / 1000);
    return {
      success: true,
      data: { index: entryIndex, label, url, username, encryptedBlobId: blobId, isActive: true, createdAt: now, updatedAt: now },
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function handleDecryptCredential(
  payload: unknown
): Promise<ExtensionResponse<{ password: string }>> {
  const { publicKey, encryptedBlobId } = payload as {
    publicKey: string;
    encryptedBlobId: string;
  };

  try {
    const { keyShare } = await requireUnlocked(publicKey);

    const encryptedB64 = await downloadEncryptedCredential(encryptedBlobId);
    const credential = await decryptCredential(encryptedB64, keyShare);

    resetAutoLock();
    return { success: true, data: { password: credential.password } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function handleDeleteCredential(payload: unknown): Promise<ExtensionResponse> {
  const { publicKey, entryIndex } = payload as { publicKey: string; entryIndex: number };

  try {
    const { keypair } = await requireUnlocked(publicKey);
    await deleteEntry(new PublicKey(publicKey), keypair, entryIndex);
    resetAutoLock();
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function handleGetCredentialsForUrl(
  payload: unknown
): Promise<ExtensionResponse<VaultEntry[]>> {
  const { publicKey, url } = payload as { publicKey: string; url: string };

  try {
    const ownerKey = new PublicKey(publicKey);

    const profile = await fetchUserProfile(ownerKey);
    if (!profile) return { success: true, data: [] };

    const allEntries = await fetchVaultEntries(ownerKey, profile.entryCount);
    const activeEntries = allEntries.filter((e) => e.isActive);

    // Encrypt FHE: private URL matching — Encrypt network compares hashes without seeing URLs
    const storedCiphertexts = activeEntries.map((e) =>
      new Uint8Array(e.encryptedUrlHash ?? [])
    );
    const storedPlaintextUrls = activeEntries.map((e) => e.url);

    const matchIndices = await searchPrivate(storedCiphertexts, url, storedPlaintextUrls);
    const matches = matchIndices.map((i) => activeEntries[i]);
    return { success: true, data: matches };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Returns the cached key share + signing keypair if vault is unlocked.
 * Throws VAULT_LOCKED (caller must show PIN unlock UI) or VAULT_NOT_SETUP.
 */
async function requireUnlocked(
  publicKey: string
): Promise<{ keyShare: DWalletKeyShare; keypair: Keypair }> {
  if (cachedKeyShare && cachedKeypair) {
    return { keyShare: cachedKeyShare, keypair: cachedKeypair };
  }

  // Service worker may have been killed — caller must re-unlock via PIN
  const store = await getVaultKeyStore(publicKey);
  if (!store) throw new Error("VAULT_NOT_SETUP");
  throw new Error("VAULT_LOCKED");
}

/**
 * Unlock vault: derive AES key from PIN + stored salt, decrypt key share.
 * Caches both in memory and resets auto-lock timer.
 */
async function unlockWithPin(publicKey: string, pin: string): Promise<DWalletKeyShare | null> {
  const store = await getVaultKeyStore(publicKey);
  if (!store) return null;

  // H-01: verification happens implicitly via AES-GCM tag — wrong PIN throws on decrypt
  const aesKey = await deriveKeyFromPin(pin, store.saltB64);
  try {
    const keyShare = await decryptKeyShare(store.encryptedKeyShareB64, aesKey);
    const privKeySeed = await decryptRaw(store.encryptedPrivKeyB64, aesKey);

    cachedAesKey = aesKey;
    cachedKeyShare = keyShare;
    cachedKeypair = Keypair.fromSeed(privKeySeed);
    resetAutoLock();

    return keyShare;
  } catch {
    return null;
  }
}

async function getVaultKeyStore(publicKey: string): Promise<VaultKeyStore | null> {
  const result = await chrome.storage.local.get(`vaultKey_${publicKey}`);
  return (result[`vaultKey_${publicKey}`] as VaultKeyStore) ?? null;
}

async function maybeInitVault(publicKey: string) {
  if (!cachedKeyShare) return; // Can't init without key share
  await maybeInitVaultWithKeyShare(publicKey, cachedKeyShare);
}

async function maybeInitVaultWithKeyShare(publicKey: string, keyShare: DWalletKeyShare) {
  try {
    const ownerKey = new PublicKey(publicKey);

    const existing = await fetchUserProfile(ownerKey);
    if (!existing) {
      if (!cachedKeypair) {
        console.warn("IkaVault: cannot init vault — keypair not cached");
        return;
      }
      await initVault(ownerKey, cachedKeypair, keyShare.dwalletId, "");
      console.log("IkaVault: UserProfile PDA initialized for", publicKey);
    }

    // Broadcast to content scripts
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          type: "AUTH_UPDATE",
          payload: { publicKey },
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.error("maybeInitVault failed:", err);
  }
}

// ─── AES-GCM raw bytes helpers ────────────────────────────────────────────────

async function encryptRaw(data: Uint8Array, aesKey: CryptoKey): Promise<string> {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, data);
  const packed = new Uint8Array(12 + ciphertext.byteLength);
  packed.set(nonce, 0);
  packed.set(new Uint8Array(ciphertext), 12);
  return bytesToBase64(packed);
}

async function decryptRaw(encryptedB64: string, aesKey: CryptoKey): Promise<Uint8Array> {
  const packed = base64ToBytes(encryptedB64);
  const nonce = packed.slice(0, 12);
  const ciphertext = packed.slice(12);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, aesKey, ciphertext);
  return new Uint8Array(plaintext);
}
