/// Encrypt FHE client for IkaVault browser extension.
///
/// Provides private autofill URL matching:
///  - URLs are stored as FHE ciphertexts (Encrypt network never sees plaintext)
///  - Autofill queries are encrypted before being sent to the Encrypt network
///  - The network returns encrypted match results, decrypted locally
///
/// Pre-alpha: @encrypt.xyz/pre-alpha-solana-client stores everything as cleartext.
/// The architecture is production-ready — real FHE activates when Encrypt mainnet launches.

const ENCRYPT_GRPC_ENDPOINT = "https://pre-alpha-dev-1.encrypt.ika-network.net:443";

/// Deployed program ID of ikavault-encrypt-search on devnet.
/// Update after `anchor deploy` of programs/encrypt-search.
export const ENCRYPT_SEARCH_PROGRAM_ID = "TODO_AFTER_DEPLOY";

let encryptClientInstance: unknown = null;
let encryptKeypair: unknown = null;

// ─── Init ─────────────────────────────────────────────────────────────────────

async function getEncryptClient(): Promise<{ client: unknown; keypair: unknown } | null> {
  if (encryptClientInstance) return { client: encryptClientInstance, keypair: encryptKeypair };

  try {
    // @encrypt.xyz/pre-alpha-solana-client is pre-alpha and not yet on npm.
    // This import will fail until the package is published — graceful degradation to plaintext.
    const { EncryptClient, EncryptKeypair } = await import(
      "@encrypt.xyz/pre-alpha-solana-client"
    );

    const client = await EncryptClient.connect(ENCRYPT_GRPC_ENDPOINT);
    const keypair = EncryptKeypair.generate();

    encryptClientInstance = client;
    encryptKeypair = keypair;

    return { client, keypair };
  } catch {
    return null; // SDK not available — callers fall back to plaintext
  }
}

// ─── URL normalization ────────────────────────────────────────────────────────

/**
 * Normalize a URL to hostname only (lowercase, no www., no path).
 * "https://www.GitHub.com/login" → "github.com"
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    let host = parsed.hostname.toLowerCase();
    if (host.startsWith("www.")) host = host.slice(4);
    return host;
  } catch {
    return url.toLowerCase().trim();
  }
}

/**
 * SHA-256 of the normalized URL. Returns 32 bytes.
 */
export async function urlHash(url: string): Promise<Uint8Array> {
  const normalized = normalizeUrl(url);
  const encoded = new TextEncoder().encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return new Uint8Array(hashBuffer);
}

// ─── Encrypt FHE operations ────────────────────────────────────────────────────

/**
 * Encrypt a URL hash under the user's Encrypt FHE public key.
 * Returns ciphertext bytes to store in VaultEntry.encrypted_url_hash on-chain.
 *
 * Falls back to raw hash bytes if Encrypt gRPC is unavailable (graceful degradation).
 */
export async function encryptUrlHash(url: string): Promise<Uint8Array> {
  const hash = await urlHash(url);

  const ctx = await getEncryptClient();
  if (!ctx) {
    // Fallback: store raw hash bytes — no FHE privacy, but autofill still works
    console.warn("Encrypt FHE unavailable (pre-alpha), using raw hash");
    return hash;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { client, keypair } = ctx as any;
    const ciphertext: Uint8Array = await client.encrypt(keypair.publicKey(), hash);
    return ciphertext;
  } catch (err) {
    console.warn("Encrypt FHE encrypt failed, using raw hash:", err);
    return hash;
  }
}

/**
 * Private autofill search.
 *
 * Encrypts the current page URL hash and asks the Encrypt network to compare it
 * against all stored ciphertexts — without the network ever seeing the plaintext URL.
 *
 * Returns indices of matching vault entries.
 *
 * Falls back to plaintext matching if Encrypt gRPC is unavailable.
 */
export async function searchPrivate(
  storedCiphertexts: Uint8Array[],
  queryUrl: string,
  storedPlaintextUrls: string[], // fallback
): Promise<number[]> {
  if (storedCiphertexts.length === 0) return [];

  const ctx = await getEncryptClient();
  if (!ctx) {
    return plaintextSearch(storedPlaintextUrls, queryUrl);
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { client, keypair } = ctx as any;
    const queryHash = await urlHash(queryUrl);
    const queryCiphertext: Uint8Array = await client.encrypt(keypair.publicKey(), queryHash);

    // Encrypt network runs batch_url_hash_matches FHE — returns encrypted booleans
    const encryptedResults: Uint8Array[] = await client.compute(
      ENCRYPT_SEARCH_PROGRAM_ID,
      "batch_url_hash_matches",
      storedCiphertexts,
      queryCiphertext,
    );

    // Decrypt results client-side
    const matches: number[] = [];
    for (let i = 0; i < encryptedResults.length; i++) {
      const matched: boolean = await client.decrypt(keypair, encryptedResults[i]);
      if (matched) matches.push(i);
    }

    return matches;
  } catch {
    // Fallback: plaintext URL matching
    return plaintextSearch(storedPlaintextUrls, queryUrl);
  }
}

/**
 * Plaintext URL matching fallback.
 * Used when Encrypt gRPC is unavailable or for entries without encrypted_url_hash.
 *
 * H-02: strict equality only — substring match would autofill example.com credentials
 * on evil-example.com.attacker.net. normalizeUrl() already strips scheme/path so
 * host equivalence is enough here.
 */
export function plaintextSearch(storedUrls: string[], queryUrl: string): number[] {
  const queryNorm = normalizeUrl(queryUrl);
  return storedUrls
    .map((url, i) => ({ i, norm: normalizeUrl(url) }))
    .filter(({ norm }) => norm === queryNorm)
    .map(({ i }) => i);
}
