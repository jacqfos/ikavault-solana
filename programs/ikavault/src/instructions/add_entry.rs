use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::VaultError;

/// Adds a new vault entry (credential pointer) for the user.
/// The actual encrypted data lives on Walrus — we only store the blob ID.
#[derive(Accounts)]
#[instruction(label: String, url: String, username: String, encrypted_blob_id: String, encrypted_url_hash: Vec<u8>)]
pub struct AddEntry<'info> {
    #[account(
        mut,
        seeds = [b"user_profile", owner.key().as_ref()],
        bump = user_profile.bump,
        has_one = owner @ VaultError::Unauthorized,
    )]
    pub user_profile: Account<'info, UserProfile>,

    #[account(
        init,
        payer = owner,
        space = VaultEntry::SPACE,
        seeds = [
            b"vault_entry",
            owner.key().as_ref(),
            &user_profile.entry_count.to_le_bytes(),
        ],
        bump
    )]
    pub vault_entry: Account<'info, VaultEntry>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<AddEntry>,
    label: String,
    url: String,
    username: String,
    encrypted_blob_id: String,
    encrypted_url_hash: Vec<u8>,
) -> Result<()> {
    require!(label.len() <= MAX_LABEL_LEN, VaultError::LabelTooLong);
    require!(url.len() <= MAX_URL_LEN, VaultError::UrlTooLong);
    require!(username.len() <= MAX_USERNAME_LEN, VaultError::UsernameTooLong);
    require!(encrypted_blob_id.len() <= MAX_BLOB_ID_LEN, VaultError::BlobIdTooLong);
    require!(
        encrypted_url_hash.len() <= MAX_ENCRYPTED_URL_HASH_LEN,
        VaultError::EncryptedHashTooLong
    );
    require!(
        ctx.accounts.user_profile.entry_count < MAX_VAULT_ENTRIES as u32,
        VaultError::VaultFull
    );

    let clock = Clock::get()?;
    let index = ctx.accounts.user_profile.entry_count;

    let entry = &mut ctx.accounts.vault_entry;
    entry.owner = ctx.accounts.owner.key();
    entry.index = index;
    entry.label = label;
    entry.url = url;
    entry.encrypted_url_hash = encrypted_url_hash;
    entry.username = username;
    entry.encrypted_blob_id = encrypted_blob_id;
    entry.is_active = true;
    entry.created_at = clock.unix_timestamp;
    entry.updated_at = clock.unix_timestamp;
    entry.bump = ctx.bumps.vault_entry;

    ctx.accounts.user_profile.entry_count = index + 1;
    ctx.accounts.user_profile.updated_at = clock.unix_timestamp;

    msg!("IkaVault: added entry #{} ('{}') for {}", index, entry.label, entry.owner);
    Ok(())
}
