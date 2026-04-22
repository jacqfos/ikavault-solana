/// IkaVault off-chain client.
///
/// Handles:
/// - Ika dWallet creation (mock in pre-alpha)
/// - Client-side encryption/decryption
/// - Walrus blob upload/download
/// - Solana program interaction via Anchor client
mod dwallet;
mod encrypt;
mod walrus;

use anyhow::Result;
use solana_sdk::signature::read_keypair_file;
use tracing::info;

#[tokio::main]
async fn main() -> Result<()> {
    // Load .env if present
    let _ = dotenv::dotenv();

    // Init logging
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("ikavault_client=debug".parse()?),
        )
        .init();

    info!("IkaVault client starting");

    let keypair_path = std::env::var("SOLANA_KEYPAIR")
        .unwrap_or_else(|_| format!("{}/.config/solana/id.json", std::env::var("HOME").unwrap()));
    let payer = read_keypair_file(&keypair_path)
        .map_err(|e| anyhow::anyhow!("Failed to load keypair from {}: {}", keypair_path, e))?;

    demo_flow(&payer).await?;

    Ok(())
}

async fn demo_flow(payer: &solana_sdk::signature::Keypair) -> Result<()> {
    use dwallet::{CredentialPayload, DWallet};
    use walrus::WalrusClient;

    info!("=== IkaVault Demo Flow ===");

    // 1. Create dWallet via Ika gRPC (falls back to mock if unavailable)
    info!("Step 1: Creating dWallet via Ika gRPC...");
    let dwallet = DWallet::create(payer).await?;
    info!("dWallet ID: {}", dwallet.id);

    // 2. Create a test credential
    info!("Step 2: Creating test credential...");
    let credential = CredentialPayload::new("super_secret_password_123!");
    info!("Credential created for: github.com");

    // 3. Encrypt the credential with dWallet key
    info!("Step 3: Encrypting with dWallet key...");
    let encrypted = credential.encrypt_with(&dwallet)?;
    info!("Encrypted {} bytes", encrypted.len());

    // 4. Upload to Walrus
    info!("Step 4: Uploading to Walrus...");
    let walrus = WalrusClient::new();

    // NOTE: Walrus testnet may be unavailable — skip upload in demo if needed
    match walrus.upload_encrypted_credential(&encrypted).await {
        Ok(blob_id) => {
            info!("Walrus blob ID: {}", blob_id);

            // 5. Download and decrypt to verify
            info!("Step 5: Downloading and decrypting...");
            let downloaded = walrus.download_encrypted_credential(&blob_id).await?;
            let decrypted = CredentialPayload::decrypt_from(&downloaded, &dwallet)?;
            assert_eq!(decrypted.password, "super_secret_password_123!");
            info!("Decryption verified! Password: {}", decrypted.password);
        }
        Err(e) => {
            info!("Walrus upload skipped (testnet may be unavailable): {}", e);
            info!("Verifying local encrypt/decrypt roundtrip instead...");
            let decrypted = CredentialPayload::decrypt_from(&encrypted, &dwallet)?;
            assert_eq!(decrypted.password, "super_secret_password_123!");
            info!("Local encrypt/decrypt roundtrip: OK");
        }
    }

    // 6. Encrypt URL hash with Encrypt FHE
    info!("Step 6: Encrypting URL hash with Encrypt FHE...");
    match encrypt::EncryptVaultClient::new().await {
        Ok(encrypt_client) => {
            let url = "https://github.com";
            let ciphertext = encrypt_client.encrypt_url_hash(url).await?;
            info!("Encrypt FHE ciphertext for '{}': {} bytes", url, ciphertext.len());

            // Simulate search
            let matches = encrypt_client.search_private(&[ciphertext], url).await?;
            info!("Private search matched {} entries", matches.len());
        }
        Err(e) => {
            info!("Encrypt gRPC unavailable (pre-alpha): {}", e);
            // Demonstrate URL normalization + hashing locally
            let hash = encrypt::EncryptVaultClient::url_hash("https://github.com/login");
            info!("SHA-256(normalize('github.com')): {}", hex::encode(hash));
        }
    }

    info!("=== Demo Flow Complete ===");
    Ok(())
}
