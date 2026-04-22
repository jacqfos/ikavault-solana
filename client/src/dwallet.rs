/// Ika dWallet integration module.
///
/// Uses the Ika pre-alpha gRPC SDK for dWallet creation (DKG).
/// Encryption uses AES-256-GCM with a key derived from the dWallet's
/// user key share — the real flow would use ECIES with the dWallet
/// public key, but that's not yet available in the pre-alpha SDK.
///
/// Pre-alpha caveats (from Ika docs):
/// - NO real MPC signing — single mock signer on the network side
/// - Keys, trust model, protocol NOT final
/// - All on-chain state may be wiped periodically
use anyhow::Result;
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use rand::RngCore;
use tracing::{info, warn};

pub const IKA_GRPC_ENDPOINT: &str = "https://pre-alpha-dev-1.ika.ika-network.net:443";

/// Represents a dWallet key pair.
#[derive(Debug, Clone)]
pub struct DWallet {
    /// dWallet ID — the on-chain address returned by DKG (or mock ID)
    pub id: String,
    /// dWallet public key (from DKG response)
    pub public_key: Vec<u8>,
    /// User's local key share for encryption (32 bytes, AES-256 key)
    pub user_key_share: Vec<u8>,
}

impl DWallet {
    /// Create a new dWallet via Ika gRPC DKG.
    /// Falls back to mock if gRPC is unavailable.
    pub async fn create(payer: &solana_sdk::signature::Keypair) -> Result<Self> {
        match Self::create_via_grpc(payer).await {
            Ok(dw) => {
                info!("dWallet created via Ika gRPC: id={}", dw.id);
                Ok(dw)
            }
            Err(e) => {
                warn!("Ika gRPC DKG failed ({}), using mock fallback", e);
                Self::create_mock()
            }
        }
    }

    /// Create dWallet via Ika pre-alpha gRPC DKG.
    async fn create_via_grpc(payer: &solana_sdk::signature::Keypair) -> Result<Self> {
        use ika_dwallet_types::*;
        use ika_grpc::d_wallet_service_client::DWalletServiceClient;
        use ika_grpc::UserSignedRequest;
        use solana_sdk::signer::Signer;

        let tls = tonic::transport::ClientTlsConfig::new().with_native_roots();
        let channel = tonic::transport::Channel::from_shared(IKA_GRPC_ENDPOINT)
            .map_err(|e| anyhow::anyhow!("invalid gRPC URL: {}", e))?
            .tls_config(tls)?
            .connect()
            .await?;

        let mut grpc_client = DWalletServiceClient::new(channel);

        // Build DKG request (pre-alpha uses zeroed proofs — mock signer)
        let signed_data = bcs::to_bytes(&SignedRequestData {
            session_identifier_preimage: [0u8; 32],
            epoch: 1,
            chain_id: ChainId::Solana,
            intended_chain_sender: payer.pubkey().to_bytes().to_vec(),
            request: DWalletRequest::DKG {
                dwallet_network_encryption_public_key: vec![0u8; 32],
                curve: DWalletCurve::Curve25519,
                centralized_public_key_share_and_proof: vec![0u8; 32],
                encrypted_centralized_secret_share_and_proof: vec![0u8; 32],
                encryption_key: vec![0u8; 32],
                user_public_output: vec![0u8; 32],
                signer_public_key: payer.pubkey().to_bytes().to_vec(),
            },
        })?;

        let user_sig = bcs::to_bytes(&UserSignature::Ed25519 {
            signature: vec![0u8; 64], // mock sig — pre-alpha doesn't verify
            public_key: payer.pubkey().to_bytes().to_vec(),
        })?;

        let response = grpc_client
            .submit_transaction(UserSignedRequest {
                user_signature: user_sig,
                signed_request_data: signed_data,
            })
            .await?;

        let response_data: TransactionResponseData =
            bcs::from_bytes(&response.into_inner().response_data)?;

        let attestation_data = match response_data {
            TransactionResponseData::Attestation { attestation_data, .. } => attestation_data,
            other => anyhow::bail!("unexpected DKG response: {:?}", other),
        };

        // attestation layout: [32 bytes dWallet addr | 1 byte pk_len | pk_bytes]
        anyhow::ensure!(attestation_data.len() >= 33, "attestation too short");
        let dwallet_addr: [u8; 32] = attestation_data[0..32].try_into()?;
        let pk_len = attestation_data[32] as usize;
        anyhow::ensure!(
            attestation_data.len() >= 33 + pk_len,
            "attestation truncated"
        );
        let public_key = attestation_data[33..33 + pk_len].to_vec();

        // Derive a deterministic encryption key from the dWallet address
        // (in production: would use the dWallet public key via ECIES)
        let key_share = derive_key_from_address(&dwallet_addr);

        Ok(DWallet {
            id: format!("ika_{}", hex::encode(dwallet_addr)),
            public_key,
            user_key_share: key_share,
        })
    }

    /// Mock fallback — generates a random key locally.
    fn create_mock() -> Result<Self> {
        let mut key = vec![0u8; 32];
        rand::thread_rng().fill_bytes(&mut key);
        let id = format!("mock_dwallet_{}", B64.encode(&key[..8]));
        Ok(DWallet {
            id,
            public_key: key.clone(),
            user_key_share: key,
        })
    }

    pub fn from_key_share(id: String, key_share: Vec<u8>) -> Self {
        DWallet {
            id,
            public_key: key_share.clone(),
            user_key_share: key_share,
        }
    }

    /// Encrypt data using AES-256-GCM with this dWallet's key share.
    pub fn encrypt(&self, plaintext: &[u8]) -> Result<Vec<u8>> {
        use aes_gcm::{aead::{Aead, KeyInit}, Aes256Gcm, Nonce};

        let cipher = Aes256Gcm::new_from_slice(&self.user_key_share)
            .map_err(|e| anyhow::anyhow!("AES key init: {}", e))?;

        let mut nonce_bytes = [0u8; 12];
        rand::thread_rng().fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        let ciphertext = cipher.encrypt(nonce, plaintext)
            .map_err(|e| anyhow::anyhow!("Encryption failed: {}", e))?;

        let mut result = nonce_bytes.to_vec();
        result.extend_from_slice(&ciphertext);
        Ok(result)
    }

    /// Decrypt data using AES-256-GCM.
    pub fn decrypt(&self, ciphertext: &[u8]) -> Result<Vec<u8>> {
        use aes_gcm::{aead::{Aead, KeyInit}, Aes256Gcm, Nonce};

        anyhow::ensure!(ciphertext.len() > 12, "Ciphertext too short");
        let (nonce_bytes, data) = ciphertext.split_at(12);
        let cipher = Aes256Gcm::new_from_slice(&self.user_key_share)
            .map_err(|e| anyhow::anyhow!("AES key init: {}", e))?;
        let nonce = Nonce::from_slice(nonce_bytes);

        cipher.decrypt(nonce, data)
            .map_err(|e| anyhow::anyhow!("Decryption failed: {}", e))
    }

    pub fn export_key_share_b64(&self) -> String {
        B64.encode(&self.user_key_share)
    }

    pub fn import_key_share_b64(id: String, b64: &str) -> Result<Self> {
        let key = B64.decode(b64)?;
        Ok(Self::from_key_share(id, key))
    }
}

/// Derive a 32-byte AES key from a dWallet address using SHA-256.
fn derive_key_from_address(addr: &[u8; 32]) -> Vec<u8> {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(b"ikavault_encryption_key_v1");
    hasher.update(addr);
    hasher.finalize().to_vec()
}

/// Credential payload stored encrypted on Walrus.
#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct CredentialPayload {
    pub password: String,
    pub totp_secret: Option<String>,
    pub notes: Option<String>,
    pub version: u32,
}

impl CredentialPayload {
    pub fn new(password: impl Into<String>) -> Self {
        Self { password: password.into(), totp_secret: None, notes: None, version: 1 }
    }

    pub fn encrypt_with(&self, dwallet: &DWallet) -> Result<Vec<u8>> {
        let json = serde_json::to_vec(self)?;
        dwallet.encrypt(&json)
    }

    pub fn decrypt_from(data: &[u8], dwallet: &DWallet) -> Result<Self> {
        let json = dwallet.decrypt(data)?;
        Ok(serde_json::from_slice(&json)?)
    }
}
