/// Client-side encryption module.
///
/// Security model (C approach):
///   PIN + SHA-256(Web3Auth_privkey) → PBKDF2-SHA256 → AES-256-GCM key
///   → encrypts the dWallet key share in chrome.storage.local
///
/// Gmail-only breach: attacker derives same salt (same Google → same privkey via
/// Web3Auth threshold scheme), but still needs the PIN.
/// Device-only breach: storage contains encrypted key share, PIN required to decrypt.
/// Gmail + device breach: encrypted key share is useless without the PIN.
///
/// PRODUCTION: Replace mock keyShare derivation with Ika 2PC-MPC.

import type { CredentialPayload, DWalletKeyShare } from "./types";

const PBKDF2_ITERATIONS = 100_000;

// ─── PIN + Web3Auth key derivation ────────────────────────────────────────────

/**
 * Compute PBKDF2 salt from Web3Auth private key.
 * SHA-256(privkey) is stored in chrome.storage — it's a hash, not the key itself.
 * Deterministic per Google account (Web3Auth gives the same privkey on any device).
 */
export async function computeSaltFromPrivKey(privKeyB64: string): Promise<string> {
  const raw = base64ToBytes(privKeyB64);
  const hash = await crypto.subtle.digest("SHA-256", raw);
  return bytesToBase64(new Uint8Array(hash));
}

/**
 * Derive AES-256-GCM key from PIN + salt (SHA-256 of Web3Auth privkey).
 * Uses PBKDF2-SHA256 with 100k iterations.
 */
export async function deriveKeyFromPin(pin: string, saltB64: string): Promise<CryptoKey> {
  const pinBytes = new TextEncoder().encode(pin);
  const salt = base64ToBytes(saltB64);

  const baseKey = await crypto.subtle.importKey(
    "raw",
    pinBytes,
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt a key share using the PIN-derived AES key.
 * Returns base64-encoded ciphertext (12-byte nonce prepended).
 */
export async function encryptKeyShare(
  keyShare: DWalletKeyShare,
  aesKey: CryptoKey
): Promise<string> {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(keyShare));

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    aesKey,
    plaintext
  );

  const packed = new Uint8Array(12 + ciphertext.byteLength);
  packed.set(nonce, 0);
  packed.set(new Uint8Array(ciphertext), 12);
  return bytesToBase64(packed);
}

/**
 * Decrypt a key share using the PIN-derived AES key.
 * Throws DOMException if PIN is wrong (AES-GCM auth tag fails).
 */
export async function decryptKeyShare(
  encryptedB64: string,
  aesKey: CryptoKey
): Promise<DWalletKeyShare> {
  const packed = base64ToBytes(encryptedB64);
  const nonce = packed.slice(0, 12);
  const ciphertext = packed.slice(12);

  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: nonce },
    aesKey,
    ciphertext
  );

  return JSON.parse(new TextDecoder().decode(plaintext)) as DWalletKeyShare;
}

/**
 * Derive an AES-256-GCM key from a base64 key share.
 * Uses SHA-256 to normalize any length key to 256 bits.
 */
async function deriveAesKey(keyShareB64: string): Promise<CryptoKey> {
  const raw = base64ToBytes(keyShareB64);
  // Hash the key share to get a consistent 256-bit key
  const hashBuffer = await crypto.subtle.digest("SHA-256", raw);

  return crypto.subtle.importKey(
    "raw",
    hashBuffer,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt a credential payload using the dWallet key share.
 * Returns base64-encoded ciphertext (nonce prepended).
 */
export async function encryptCredential(
  credential: CredentialPayload,
  keyShare: DWalletKeyShare
): Promise<string> {
  const key = await deriveAesKey(keyShare.keyShareB64);
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(credential));

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    key,
    plaintext
  );

  // Pack: [12 bytes nonce | ciphertext]
  const packed = new Uint8Array(nonce.byteLength + ciphertext.byteLength);
  packed.set(nonce, 0);
  packed.set(new Uint8Array(ciphertext), nonce.byteLength);

  return bytesToBase64(packed);
}

/**
 * Decrypt a credential payload from base64 ciphertext.
 */
export async function decryptCredential(
  encryptedB64: string,
  keyShare: DWalletKeyShare
): Promise<CredentialPayload> {
  const key = await deriveAesKey(keyShare.keyShareB64);
  const packed = base64ToBytes(encryptedB64);

  if (packed.length < 13) {
    throw new Error("Ciphertext too short");
  }

  const nonce = packed.slice(0, 12);
  const ciphertext = packed.slice(12);

  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: nonce },
    key,
    ciphertext
  );

  return JSON.parse(new TextDecoder().decode(plaintext)) as CredentialPayload;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
