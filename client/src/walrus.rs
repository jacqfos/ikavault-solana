/// Walrus decentralized blob storage integration.
///
/// Uses Staketab public publisher (same pattern as previous Walrus projects).
/// Walrus REST API: https://publisher.walrus.site / https://aggregator.walrus.site
use anyhow::{Context, Result};
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use serde::{Deserialize, Serialize};
use tracing::{debug, info};

// Walrus devnet endpoints
pub const WALRUS_PUBLISHER: &str = "https://publisher.walrus-testnet.walrus.space";
pub const WALRUS_AGGREGATOR: &str = "https://aggregator.walrus-testnet.walrus.space";

/// Default storage epochs (1 epoch ≈ 1 day on testnet)
pub const DEFAULT_EPOCHS: u64 = 3; // testnet limit is small

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WalrusUploadResponse {
    pub newly_created: Option<NewlyCreated>,
    pub already_certified: Option<AlreadyCertified>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewlyCreated {
    pub blob_object: BlobObject,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AlreadyCertified {
    pub blob_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BlobObject {
    pub blob_id: String,
}

impl WalrusUploadResponse {
    pub fn blob_id(&self) -> Option<&str> {
        if let Some(ref nc) = self.newly_created {
            Some(&nc.blob_object.blob_id)
        } else if let Some(ref ac) = self.already_certified {
            Some(&ac.blob_id)
        } else {
            None
        }
    }
}

pub struct WalrusClient {
    http: reqwest::Client,
    publisher: String,
    aggregator: String,
}

impl WalrusClient {
    pub fn new() -> Self {
        Self {
            http: reqwest::Client::new(),
            publisher: WALRUS_PUBLISHER.to_string(),
            aggregator: WALRUS_AGGREGATOR.to_string(),
        }
    }

    pub fn with_endpoints(publisher: impl Into<String>, aggregator: impl Into<String>) -> Self {
        Self {
            http: reqwest::Client::new(),
            publisher: publisher.into(),
            aggregator: aggregator.into(),
        }
    }

    /// Upload raw bytes to Walrus.
    /// Returns the blob ID on success.
    pub async fn upload(&self, data: &[u8], epochs: Option<u64>) -> Result<String> {
        let epochs = epochs.unwrap_or(DEFAULT_EPOCHS);
        let url = format!("{}/v1/blobs?epochs={}", self.publisher, epochs);

        debug!("Uploading {} bytes to Walrus (epochs={})", data.len(), epochs);

        let response = self
            .http
            .put(&url)
            .header("Content-Type", "application/octet-stream")
            .body(data.to_vec())
            .send()
            .await
            .context("Walrus upload HTTP request failed")?;

        let status = response.status();
        let body = response.bytes().await?;

        if !status.is_success() {
            anyhow::bail!(
                "Walrus upload failed ({}): {}",
                status,
                String::from_utf8_lossy(&body)
            );
        }

        debug!("Walrus upload response: {}", String::from_utf8_lossy(&body));

        let parsed: WalrusUploadResponse =
            serde_json::from_slice(&body).context("Failed to parse Walrus upload response")?;

        parsed
            .blob_id()
            .map(|s| s.to_string())
            .context("Walrus response missing blob_id")
            .inspect(|id| info!("Walrus upload success: blob_id={}", id))
    }

    /// Download raw bytes from Walrus by blob ID.
    pub async fn download(&self, blob_id: &str) -> Result<Vec<u8>> {
        let url = format!("{}/v1/blobs/{}", self.aggregator, blob_id);
        debug!("Downloading blob {} from Walrus", blob_id);

        let response = self
            .http
            .get(&url)
            .send()
            .await
            .context("Walrus download HTTP request failed")?;

        let status = response.status();
        if !status.is_success() {
            anyhow::bail!("Walrus download failed ({}): blob_id={}", status, blob_id);
        }

        let data = response.bytes().await?.to_vec();
        info!("Walrus download success: {} bytes for blob {}", data.len(), blob_id);
        Ok(data)
    }

    /// Upload an encrypted credential payload, returns blob ID.
    pub async fn upload_encrypted_credential(&self, encrypted: &[u8]) -> Result<String> {
        self.upload(encrypted, None).await
    }

    /// Download and return raw encrypted bytes for a blob ID.
    pub async fn download_encrypted_credential(&self, blob_id: &str) -> Result<Vec<u8>> {
        self.download(blob_id).await
    }
}

impl Default for WalrusClient {
    fn default() -> Self {
        Self::new()
    }
}
