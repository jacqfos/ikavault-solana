// Maps background error codes to human-readable UI messages.
// VAULT_LOCKED is handled globally (routes to PIN screen) so it shouldn't reach the UI,
// but we cover it for defence-in-depth.

const MESSAGES: Record<string, string> = {
  VAULT_LOCKED: "Your vault is locked. Enter your PIN to continue.",
  VAULT_NOT_SETUP: "Vault not set up yet. Please sign in to initialize it.",
  PIN_NOT_SETUP: "PIN not configured — finish the onboarding flow.",
  WALRUS_UPLOAD_FAILED: "Couldn't reach Walrus. Check your connection and try again.",
  WALRUS_DOWNLOAD_FAILED: "Couldn't download the encrypted blob from Walrus.",
  DECRYPT_FAILED: "Decryption failed — the blob may be corrupt or the wrong key.",
  SOLANA_TX_FAILED: "Solana transaction failed. The devnet may be busy — try again.",
};

export function humanizeError(code: string | undefined, fallback: string): string {
  if (!code) return fallback;
  return MESSAGES[code] ?? fallback;
}
