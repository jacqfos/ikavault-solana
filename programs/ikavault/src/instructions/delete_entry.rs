use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::VaultError;

/// Soft-deletes a vault entry (sets is_active = false).
/// The Walrus blob will be allowed to expire naturally.
#[derive(Accounts)]
#[instruction(entry_index: u32)]
pub struct DeleteEntry<'info> {
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

pub fn handler(ctx: Context<DeleteEntry>, _entry_index: u32) -> Result<()> {
    let clock = Clock::get()?;

    ctx.accounts.vault_entry.is_active = false;
    ctx.accounts.vault_entry.updated_at = clock.unix_timestamp;
    ctx.accounts.user_profile.updated_at = clock.unix_timestamp;

    msg!("IkaVault: deleted entry #{}", ctx.accounts.vault_entry.index);
    Ok(())
}
