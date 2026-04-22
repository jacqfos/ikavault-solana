//! IkaVault Encrypt FHE Search Program
//!
//! Defines FHE computation executed by the Encrypt network for private autofill.
//!
//! # Architecture
//!
//! ```text
//! Browser Extension (autofill triggered)
//!     │
//!     ├─ SHA-256(normalize(current_url)) → 32-byte hash
//!     ├─ Encrypt FHE: encrypt(url_hash) → query_ciphertext  [EUint256]
//!     │
//!     └─ Encrypt gRPC → compute url_hash_matches(stored_ct, query_ct)
//!            │
//!            └─ This function runs on the Encrypt network (not on Solana validators)
//!               Returns EUint256 with value 0 (no match) or 1 (match)
//!               Client decrypts → knows if entry matches; network learned nothing
//! ```
//!
//! # Types
//! SHA-256 output = 32 bytes = 256 bits → `EUint256`
//! Equality result → `EUint256` with value all-zeros (false) or all-ones (true)
//!
//! # Pre-Alpha Note
//! No real FHE yet — everything is cleartext internally.
//! Architecturally correct for production.

// encrypt_dsl is aliased to encrypt-solana-dsl in Cargo.toml so that
// the #[encrypt_fn] macro's generated `encrypt_dsl::cpi` reference resolves.
use encrypt_dsl::prelude::*;

/// Compare two encrypted SHA-256 URL hashes for equality.
///
/// Both parameters are `EUint256` — the Encrypt FHE representation of a
/// 32-byte (256-bit) SHA-256 hash stored as a bit vector.
///
/// The Encrypt network executes this without decrypting either value.
/// Returns an `EUint256` where all bits are 1 if equal, 0 if not.
#[encrypt_fn]
pub fn url_hash_matches(
    /// Encrypt FHE ciphertext of SHA-256(normalize(stored_url))
    stored_hash: EUint256,
    /// Encrypt FHE ciphertext of SHA-256(normalize(query_url))
    query_hash: EUint256,
) -> EUint256 {
    stored_hash.is_equal(&query_hash)
}
