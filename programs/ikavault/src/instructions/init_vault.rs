use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::VaultError;

/// Initializes a UserProfile PDA for a new user.
/// Called once during onboarding after Web3Auth + dWallet creation.
#[derive(Accounts)]
pub struct InitVault<'info> {
    #[account(
        init,
        payer = owner,
        space = UserProfile::SPACE,
        seeds = [b"user_profile", owner.key().as_ref()],
        bump
    )]
    pub user_profile: Account<'info, UserProfile>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitVault>,
    dwallet_id: String,
    initial_blob_id: String,
) -> Result<()> {
    require!(dwallet_id.len() <= MAX_DWALLET_ID_LEN, VaultError::DwalletIdTooLong);
    require!(initial_blob_id.len() <= MAX_BLOB_ID_LEN, VaultError::BlobIdTooLong);

    let profile = &mut ctx.accounts.user_profile;
    let clock = Clock::get()?;

    profile.owner = ctx.accounts.owner.key();
    profile.dwallet_id = dwallet_id;
    profile.vault_blob_id = initial_blob_id;
    profile.entry_count = 0;
    profile.updated_at = clock.unix_timestamp;
    profile.bump = ctx.bumps.user_profile;

    msg!("IkaVault: initialized vault for {}", profile.owner);
    Ok(())
}
