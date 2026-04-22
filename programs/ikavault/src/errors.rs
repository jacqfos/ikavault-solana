use anchor_lang::prelude::*;

#[error_code]
pub enum VaultError {
    #[msg("Vault blob ID exceeds maximum length")]
    BlobIdTooLong,
    #[msg("URL exceeds maximum length")]
    UrlTooLong,
    #[msg("Username exceeds maximum length")]
    UsernameTooLong,
    #[msg("Label exceeds maximum length")]
    LabelTooLong,
    #[msg("Vault entry not found")]
    EntryNotFound,
    #[msg("Vault is at maximum capacity")]
    VaultFull,
    #[msg("Unauthorized: signer does not own this vault")]
    Unauthorized,
    #[msg("dWallet ID exceeds maximum length")]
    DwalletIdTooLong,
    #[msg("Shared vault: recipient already has access")]
    AlreadyShared,
    #[msg("Encrypt FHE ciphertext exceeds maximum length")]
    EncryptedHashTooLong,
}
