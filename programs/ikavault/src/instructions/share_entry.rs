use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::VaultError;

/// Shares a credential with another user.
/// Creates a SharedVaultEntry with a separate Walrus blob encrypted for the recipient.
/// The caller (owner) must have re-encrypted the credential for the recipient's dWallet key
/// off-chain and uploaded the new blob to Walrus before calling this.
#[derive(Accounts)]
#[instruction(entry_index: u32)]
pub struct ShareEntry<'info> {
    #[account(
        mut,
        seeds = [b"user_profile", owner.key().as_ref()],
        bump = user_profile.bump,
        has_one = owner @ VaultError::Unauthorized,
    )]
    pub user_profile: Account<'info, UserProfile>,

    #[account(
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

    #[account(
        init,
        payer = owner,
        space = SharedVaultEntry::SPACE,
        seeds = [
            b"shared_entry",
            owner.key().as_ref(),
            recipient.key().as_ref(),
            &entry_index.to_le_bytes(),
        ],
        bump
    )]
    pub shared_entry: Account<'info, SharedVaultEntry>,

    /// CHECK: Recipient pubkey — we only store it, no signing required
    pub recipient: AccountInfo<'info>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<ShareEntry>,
    entry_index: u32,
    recipient_encrypted_blob_id: String,
) -> Result<()> {
    require!(
        recipient_encrypted_blob_id.len() <= MAX_BLOB_ID_LEN,
        VaultError::BlobIdTooLong
    );

    let clock = Clock::get()?;
    let original = &ctx.accounts.vault_entry;

    let shared = &mut ctx.accounts.shared_entry;
    shared.owner = ctx.accounts.owner.key();
    shared.recipient = ctx.accounts.recipient.key();
    shared.origin_index = entry_index;
    shared.label = original.label.clone();
    shared.url = original.url.clone();
    shared.username = original.username.clone();
    shared.encrypted_blob_id = recipient_encrypted_blob_id;
    shared.shared_at = clock.unix_timestamp;
    shared.bump = ctx.bumps.shared_entry;

    ctx.accounts.user_profile.updated_at = clock.unix_timestamp;

    msg!(
        "IkaVault: shared entry #{} with {}",
        entry_index,
        ctx.accounts.recipient.key()
    );
    Ok(())
}
