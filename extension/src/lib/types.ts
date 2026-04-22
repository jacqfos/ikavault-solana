// ─── Vault Types ──────────────────────────────────────────────────────────────

export interface VaultEntry {
  /** On-chain index (PDA seed) */
  index: number;
  label: string;
  url: string;
  username: string;
  /** Walrus blob ID of the encrypted credential */
  encryptedBlobId: string;
  /** Encrypt FHE ciphertext of SHA-256(normalize(url)) — for private autofill matching */
  encryptedUrlHash?: number[];
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CredentialPayload {
  password: string;
  totpSecret?: string;
  notes?: string;
  version: number;
}

export interface UserProfile {
  owner: string;
  dwalletId: string;
  vaultBlobId: string;
  entryCount: number;
  updatedAt: number;
}

// ─── dWallet Types ────────────────────────────────────────────────────────────

export interface DWalletKeyShare {
  dwalletId: string;
  /** base64-encoded user key share */
  keyShareB64: string;
}

/** Encrypted vault key store — what's persisted in chrome.storage.local */
export interface VaultKeyStore {
  dwalletId: string;
  /** AES-GCM encrypted keyShareB64 (nonce prepended, base64) */
  encryptedKeyShareB64: string;
  /** AES-GCM encrypted Web3Auth privkey seed (nonce prepended, base64) — for on-chain signing */
  encryptedPrivKeyB64: string;
  /** SHA-256(Web3Auth_privkey) used as PBKDF2 salt (base64) */
  saltB64: string;
  /** PBKDF2 iteration count */
  pbkdf2Iterations: number;
}

// ─── Extension Message Types ──────────────────────────────────────────────────

export type MessageType =
  | "LOGIN_GOOGLE"
  | "GET_USER_PROFILE"
  | "SAVE_CREDENTIAL"
  | "DECRYPT_CREDENTIAL"
  | "DELETE_CREDENTIAL"
  | "GET_CREDENTIALS_FOR_URL"
  | "AUTOFILL"
  | "AUTH_UPDATE"
  | "OPEN_POPUP"
  | "LOGOUT"
  | "LOCK_VAULT"
  | "UNLOCK_VAULT"
  | "SETUP_PIN"
  | "VERIFY_PIN"
  | "HAS_PIN";

export interface ExtensionMessage<T = unknown> {
  type: MessageType;
  payload?: T;
}

export interface ExtensionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ─── Auth State ───────────────────────────────────────────────────────────────

export type AuthStatus = "unauthenticated" | "authenticating" | "authenticated" | "locked" | "pin_setup";

export interface AuthState {
  status: AuthStatus;
  /** Solana public key (from Web3Auth) */
  publicKey?: string;
  /** User's Google display name */
  displayName?: string;
  /** User's Google profile picture URL */
  profilePicture?: string;
}

// ─── App State ────────────────────────────────────────────────────────────────

export type AppView = "login" | "pin_setup" | "pin_unlock" | "vault" | "add" | "detail" | "settings";

export interface AppState {
  auth: AuthState;
  currentView: AppView;
  entries: VaultEntry[];
  selectedEntry?: VaultEntry;
  isLoading: boolean;
  error?: string;
}
