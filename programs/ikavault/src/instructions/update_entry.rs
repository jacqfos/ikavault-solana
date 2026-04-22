use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::VaultError;

/// Updates the Walrus blob ID for an existing vault entry (e.g. after password change).
/// Also allows updating label/url/username metadata.
#[derive(Accounts)]
#[instruction(entry_index: u32)]
pub struct UpdateEntry<'info> {
    #[account(
        mut,
        seeds = [b"user_profile", owner.key().as_ref()],
        bump = user_profile.bump,
        has_one = owner @ VaultError::Unauthorized,
    )]
    pub user_profile: Account<'info, UserProfile>,

    #[account(
        mut,
        seeds = [
            b"vault_entry",
            owner.key().as_ref(),
            &entry_index.to_le_bytes(),
        ],
        bump = vault_entry.bump,
        has_one = owner @ VaultError::Unauthorized,
        constraint = vault_entry.is_active @ VaultError::EntryNotFound,
    )]
    pub vault_entry: Account<'info, VaultEntry>,

    #[account(mut)]
    pub owner: Signer<'info>,
}

pub fn handler(
    ctx: Context<UpdateEntry>,
    _entry_index: u32,
    label: Option<String>,
    url: Option<String>,
    username: Option<String>,
    encrypted_blob_id: Option<String>,
) -> Result<()> {
    if let Some(ref l) = label {
        require!(l.len() <= MAX_LABEL_LEN, VaultError::LabelTooLong);
    }
    if let Some(ref u) = url {
        require!(u.len() <= MAX_URL_LEN, VaultError::UrlTooLong);
    }
    if let Some(ref u) = username {
        require!(u.len() <= MAX_USERNAME_LEN, VaultError::UsernameTooLong);
    }
    if let Some(ref b) = encrypted_blob_id {
        require!(b.len() <= MAX_BLOB_ID_LEN, VaultError::BlobIdTooLong);
    }

    let clock = Clock::get()?;
    let entry = &mut ctx.accounts.vault_entry;

    if let Some(l) = label { entry.label = l; }
    if let Some(u) = url { entry.url = u; }
    if let Some(u) = username { entry.username = u; }
    if let Some(b) = encrypted_blob_id { entry.encrypted_blob_id = b; }
    entry.updated_at = clock.unix_timestamp;

    ctx.accounts.user_profile.updated_at = clock.unix_timestamp;

    msg!("IkaVault: updated entry #{}", entry.index);
    Ok(())
}
