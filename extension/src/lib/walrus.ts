/// Walrus blob storage client (browser extension version).

const WALRUS_PUBLISHER = "https://publisher.walrus-testnet.walrus.space";
const WALRUS_AGGREGATOR = "https://aggregator.walrus-testnet.walrus.space";
const DEFAULT_EPOCHS = 3; // testnet limit

interface WalrusUploadResponse {
  newlyCreated?: { blobObject: { blobId: string; endEpoch: number } };
  alreadyCertified?: { blobId: string; endEpoch: number };
}

function extractBlobId(response: WalrusUploadResponse): string {
  if (response.newlyCreated) return response.newlyCreated.blobObject.blobId;
  if (response.alreadyCertified) return response.alreadyCertified.blobId;
  throw new Error("Walrus response missing blob_id");
}

/**
 * Upload bytes to Walrus, returns blob ID.
 */
export async function uploadBlob(
  data: Uint8Array,
  epochs = DEFAULT_EPOCHS
): Promise<string> {
  const response = await fetch(
    `${WALRUS_PUBLISHER}/v1/blobs?epochs=${epochs}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream" },
      body: data,
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Walrus upload failed (${response.status}): ${text}`);
  }

  const json = (await response.json()) as WalrusUploadResponse;
  return extractBlobId(json);
}

/**
 * Download bytes from Walrus by blob ID.
 */
export async function downloadBlob(blobId: string): Promise<Uint8Array> {
  const response = await fetch(`${WALRUS_AGGREGATOR}/v1/blobs/${blobId}`);

  if (!response.ok) {
    throw new Error(`Walrus download failed (${response.status}): ${blobId}`);
  }

  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Upload an encrypted credential string (base64) to Walrus.
 */
export async function uploadEncryptedCredential(encryptedB64: string): Promise<string> {
  const bytes = new TextEncoder().encode(encryptedB64);
  return uploadBlob(bytes);
}

/**
 * Download and return encrypted credential base64 string.
 */
export async function downloadEncryptedCredential(blobId: string): Promise<string> {
  const bytes = await downloadBlob(blobId);
  return new TextDecoder().decode(bytes);
}
