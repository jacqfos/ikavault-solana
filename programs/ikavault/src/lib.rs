use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("4y4f3BWjnCwAMw7eumBhLveJ6Uvv5i2qdgLCH3Nem6kf");

#[program]
pub mod ikavault {
    use super::*;

    /// Initialize a new vault for a user.
    /// Must be called once after Web3Auth login + dWallet creation.
    pub fn init_vault(
        ctx: Context<InitVault>,
        dwallet_id: String,
        initial_blob_id: String,
    ) -> Result<()> {
        init_vault::handler(ctx, dwallet_id, initial_blob_id)
    }

    /// Store a new credential entry (pointer to Walrus-encrypted blob).
    /// `encrypted_url_hash`: Encrypt FHE ciphertext of SHA-256(normalize(url)).
    /// Pass an empty Vec if the client doesn't support Encrypt yet (graceful degradation).
    pub fn add_entry(
        ctx: Context<AddEntry>,
        label: String,
        url: String,
        username: String,
        encrypted_blob_id: String,
        encrypted_url_hash: Vec<u8>,
    ) -> Result<()> {
        add_entry::handler(ctx, label, url, username, encrypted_blob_id, encrypted_url_hash)
    }

    /// Update an existing credential entry.
    /// Pass None for fields that should not change.
    pub fn update_entry(
        ctx: Context<UpdateEntry>,
        entry_index: u32,
        label: Option<String>,
        url: Option<String>,
        username: Option<String>,
        encrypted_blob_id: Option<String>,
    ) -> Result<()> {
        update_entry::handler(ctx, entry_index, label, url, username, encrypted_blob_id)
    }

    /// Soft-delete a credential entry.
    pub fn delete_entry(ctx: Context<DeleteEntry>, entry_index: u32) -> Result<()> {
        delete_entry::handler(ctx, entry_index)
    }

    /// Share a credential with another user (stretch goal).
    /// Caller must pre-compute recipient-encrypted blob off-chain.
    pub fn share_entry(
        ctx: Context<ShareEntry>,
        entry_index: u32,
        recipient_encrypted_blob_id: String,
    ) -> Result<()> {
        share_entry::handler(ctx, entry_index, recipient_encrypted_blob_id)
    }
}
