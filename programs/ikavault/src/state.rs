use anchor_lang::prelude::*;

// ─── Constants ───────────────────────────────────────────────────────────────

/// Walrus blob IDs are 32-byte hex strings (64 chars)
pub const MAX_BLOB_ID_LEN: usize = 64;
/// Ika dWallet IDs — base58 public keys (44 chars max)
pub const MAX_DWALLET_ID_LEN: usize = 44;
/// Credential URL (e.g. "https://github.com")
pub const MAX_URL_LEN: usize = 256;
/// Username/email
pub const MAX_USERNAME_LEN: usize = 128;
/// Human-readable label (e.g. "GitHub Work")
pub const MAX_LABEL_LEN: usize = 64;
/// Max entries per vault
pub const MAX_VAULT_ENTRIES: usize = 256;
/// Max shared recipients per entry
pub const MAX_SHARED_WITH: usize = 8;
/// Encrypt FHE ciphertext of SHA-256(normalized_url).
/// Pre-alpha: ciphertext ≈ plaintext size (32-byte hash + overhead).
/// Production: actual FHE ciphertext will be larger; increase if needed.
pub const MAX_ENCRYPTED_URL_HASH_LEN: usize = 256;

// ─── UserProfile ─────────────────────────────────────────────────────────────

/// PDA seeds: ["user_profile", owner.key()]
/// One per user — holds their dWallet ID and overall vault metadata.
#[account]
pub struct UserProfile {
    /// The wallet that owns this profile (used in PDA seed)
    pub owner: Pubkey,
    /// Ika dWallet ID for this user (mock in pre-alpha)
    pub dwallet_id: String,
    /// Walrus blob ID of the latest encrypted vault snapshot
    pub vault_blob_id: String,
    /// Number of active vault entries
    pub entry_count: u32,
    /// Unix timestamp of last update
    pub updated_at: i64,
    /// Bump for PDA derivation
    pub bump: u8,
}

impl UserProfile {
    pub const SPACE: usize = 8  // discriminator
        + 32                    // owner
        + 4 + MAX_DWALLET_ID_LEN
        + 4 + MAX_BLOB_ID_LEN
        + 4                     // entry_count
        + 8                     // updated_at
        + 1;                    // bump
}

// ─── VaultEntry ──────────────────────────────────────────────────────────────

/// PDA seeds: ["vault_entry", owner.key(), entry_index as u32 LE bytes]
/// One per stored credential. Holds a pointer to the Walrus encrypted blob.
#[account]
pub struct VaultEntry {
    /// Owner's wallet pubkey
    pub owner: Pubkey,
    /// Sequential index (matches PDA seed)
    pub index: u32,
    /// Human-readable label for the credential
    pub label: String,
    /// URL/domain the credential belongs to (plaintext, for display)
    pub url: String,
    /// Encrypt FHE ciphertext of SHA-256(normalize(url)).
    /// Stored by the Encrypt network for private URL matching during autofill.
    /// Empty if the client didn't provide an Encrypt ciphertext (graceful degradation).
    pub encrypted_url_hash: Vec<u8>,
    /// Plaintext username/email (not sensitive — password is in blob)
    pub username: String,
    /// Walrus blob ID of the encrypted credential payload
    pub encrypted_blob_id: String,
    /// Whether this entry is active (soft-delete pattern)
    pub is_active: bool,
    /// Unix timestamp of creation
    pub created_at: i64,
    /// Unix timestamp of last update
    pub updated_at: i64,
    /// Bump for PDA derivation
    pub bump: u8,
}

impl VaultEntry {
    pub const SPACE: usize = 8  // discriminator
        + 32                    // owner
        + 4                     // index
        + 4 + MAX_LABEL_LEN
        + 4 + MAX_URL_LEN
        + 4 + MAX_ENCRYPTED_URL_HASH_LEN  // Encrypt FHE ciphertext
        + 4 + MAX_USERNAME_LEN
        + 4 + MAX_BLOB_ID_LEN
        + 1                     // is_active
        + 8                     // created_at
        + 8                     // updated_at
        + 1;                    // bump
}

// ─── SharedVaultEntry ────────────────────────────────────────────────────────

/// PDA seeds: ["shared_entry", owner.key(), recipient.key(), entry_index as u32 LE bytes]
/// Created when owner shares a credential with a recipient.
/// Contains a *separate* Walrus blob encrypted for the recipient's dWallet key.
#[account]
pub struct SharedVaultEntry {
    /// Original credential owner
    pub owner: Pubkey,
    /// Recipient who can read this shared credential
    pub recipient: Pubkey,
    /// Index of the original VaultEntry
    pub origin_index: u32,
    /// Human-readable label (copied from original for recipient UX)
    pub label: String,
    /// URL (copied from original)
    pub url: String,
    /// Username (copied from original)
    pub username: String,
    /// Walrus blob ID encrypted specifically for the recipient's dWallet key
    pub encrypted_blob_id: String,
    /// Unix timestamp of sharing
    pub shared_at: i64,
    /// Bump for PDA derivation
    pub bump: u8,
}

impl SharedVaultEntry {
    pub const SPACE: usize = 8  // discriminator
        + 32                    // owner
        + 32                    // recipient
        + 4                     // origin_index
        + 4 + MAX_LABEL_LEN
        + 4 + MAX_URL_LEN
        + 4 + MAX_USERNAME_LEN
        + 4 + MAX_BLOB_ID_LEN
        + 8                     // shared_at
        + 1;                    // bump
}
