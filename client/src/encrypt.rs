//! Encrypt FHE client for IkaVault.
//!
//! Wraps `encrypt-solana-client` for:
//!  - Encrypting URL hashes before on-chain storage
//!  - Private autofill search: query the Encrypt network without revealing the URL
//!
//! # Flow
//!
//! ## Save credential:
//! ```text
//! url → normalize → SHA-256 → encrypt_url_hash() → Vec<u8> ciphertext
//!                                                       → stored in VaultEntry.encrypted_url_hash
//! ```
//!
//! ## Autofill search:
//! ```text
//! current_url → normalize → SHA-256 → encrypt_url_hash() → query_ciphertext
//!     │
//!     └─ search_private() → Encrypt gRPC → batch_url_hash_matches(stored_cts, query_ct)
//!                                               → Vec<EncryptedBool> → decrypt → match indices
//! ```
//!
//! # Pre-Alpha Note
//! `encrypt-solana-client` pre-alpha: no real FHE, cleartext internally.
//! API subject to change. Safe for hackathon demo.

use anyhow::Result;
use encrypt_solana_client::{EncryptClient, EncryptKeypair};
use sha2::{Digest, Sha256};
use tracing::info;

/// Encrypt gRPC endpoint (Solana devnet)
pub const ENCRYPT_GRPC_ENDPOINT: &str = "https://pre-alpha-dev-1.encrypt.ika-network.net:443";

/// Program ID of the deployed `ikavault-encrypt-search` program on devnet.
/// Set after `anchor deploy` of the encrypt-search program.
pub const ENCRYPT_SEARCH_PROGRAM_ID: &str = "TODO_AFTER_DEPLOY";

pub struct EncryptVaultClient {
    client: EncryptClient,
    keypair: EncryptKeypair,
}

impl EncryptVaultClient {
    /// Connect to the Encrypt gRPC endpoint and load/generate a keypair.
    pub async fn new() -> Result<Self> {
        let client = EncryptClient::connect(ENCRYPT_GRPC_ENDPOINT).await?;
        // In production: load keypair from secure storage tied to the user's dWallet.
        // For pre-alpha demo: generate a fresh keypair each run (data is cleartext anyway).
        let keypair = EncryptKeypair::generate();
        info!("Encrypt FHE client connected to {}", ENCRYPT_GRPC_ENDPOINT);
        Ok(Self { client, keypair })
    }

    /// Normalize a URL to a canonical form before hashing.
    /// Strips scheme, trailing slashes, and lowercases the hostname.
    pub fn normalize_url(url: &str) -> String {
        let url = url.trim();
        // Strip scheme
        let url = url
            .strip_prefix("https://")
            .or_else(|| url.strip_prefix("http://"))
            .unwrap_or(url);
        // Strip trailing slash and path — match on hostname only for autofill
        let hostname = url.split('/').next().unwrap_or(url);
        // Strip www. prefix
        let hostname = hostname.strip_prefix("www.").unwrap_or(hostname);
        hostname.to_lowercase()
    }

    /// Compute SHA-256 of the normalized URL.
    pub fn url_hash(url: &str) -> [u8; 32] {
        let normalized = Self::normalize_url(url);
        let mut hasher = Sha256::new();
        hasher.update(normalized.as_bytes());
        hasher.finalize().into()
    }

    /// Encrypt a URL hash under the user's Encrypt FHE public key.
    /// Returns ciphertext bytes to store in `VaultEntry.encrypted_url_hash`.
    pub async fn encrypt_url_hash(&self, url: &str) -> Result<Vec<u8>> {
        let hash = Self::url_hash(url);
        let ciphertext = self.client.encrypt(&self.keypair.public_key(), &hash).await?;
        Ok(ciphertext)
    }

    /// Private autofill search: find which vault entries match the current URL.
    ///
    /// Sends encrypted ciphertexts to the Encrypt network.
    /// The network runs `batch_url_hash_matches` FHE computation and returns
    /// encrypted booleans — it never sees the plaintext URLs.
    ///
    /// # Returns
    /// Indices into `stored_ciphertexts` where the URL matched.
    pub async fn search_private(
        &self,
        stored_ciphertexts: &[Vec<u8>],
        query_url: &str,
    ) -> Result<Vec<usize>> {
        if stored_ciphertexts.is_empty() {
            return Ok(vec![]);
        }

        let query_ct = self.encrypt_url_hash(query_url).await?;

        // Call the Encrypt network to run batch_url_hash_matches FHE
        let encrypted_results = self
            .client
            .compute(
                ENCRYPT_SEARCH_PROGRAM_ID,
                "batch_url_hash_matches",
                stored_ciphertexts,
                &query_ct,
            )
            .await?;

        // Decrypt results client-side
        let mut matches = Vec::new();
        for (i, encrypted_bool) in encrypted_results.iter().enumerate() {
            let matched: bool = self.client.decrypt(&self.keypair, encrypted_bool).await?;
            if matched {
                matches.push(i);
            }
        }

        info!(
            "Encrypt search: {}/{} entries matched for '{}'",
            matches.len(),
            stored_ciphertexts.len(),
            EncryptVaultClient::normalize_url(query_url)
        );

        Ok(matches)
    }

    /// Fallback: plaintext URL matching for entries without encrypted_url_hash.
    /// Used when Encrypt ciphertext is missing (e.g. old entries, graceful degradation).
    pub fn plaintext_matches(stored_url: &str, query_url: &str) -> bool {
        let stored_norm = Self::normalize_url(stored_url);
        let query_norm = Self::normalize_url(query_url);
        stored_norm == query_norm || stored_norm.contains(&query_norm) || query_norm.contains(&stored_norm)
    }
}
