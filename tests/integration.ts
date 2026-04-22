/**
 * IkaVault integration test — runs against devnet, no browser needed.
 *
 * Usage:
 *   npx tsx tests/integration.ts
 *
 * Uses the local Solana keypair (~/.config/solana/id.json) as the signer,
 * bypassing Web3Auth. Tests the deployed Anchor program + Walrus.
 */

import { AnchorProvider, Program, setProvider, Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

// ─── Config ───────────────────────────────────────────────────────────────────

const RPC = "https://api.testnet.solana.com";
const PROGRAM_ID = new PublicKey("F29V68fXr6zxnyw4svarp4pjiLEcPAcP4BRgA9fqXKsv");
const WALRUS_PUBLISHER = "https://publisher.walrus-testnet.walrus.space";
const WALRUS_AGGREGATOR = "https://aggregator.walrus-testnet.walrus.space";

// Load local keypair
const keypairPath = join(homedir(), ".config/solana/id.json");
const keypairBytes = JSON.parse(readFileSync(keypairPath, "utf-8")) as number[];
const signer = Keypair.fromSecretKey(Uint8Array.from(keypairBytes));

// Load IDL
// eslint-disable-next-line @typescript-eslint/no-require-imports
const IDL = JSON.parse(readFileSync(join(__dirname, "../target/idl/ikavault.json"), "utf-8"));

// ─── Anchor setup ─────────────────────────────────────────────────────────────

const connection = new Connection(RPC, "confirmed");
const wallet = new Wallet(signer);
const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
setProvider(provider);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const program = new Program(IDL as any, provider);

// ─── PDA helpers ──────────────────────────────────────────────────────────────

function getUserProfilePDA(owner: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("user_profile"), owner.toBuffer()],
    PROGRAM_ID
  )[0];
}

function getVaultEntryPDA(owner: PublicKey, index: number): PublicKey {
  const indexBuf = Buffer.alloc(4);
  indexBuf.writeUInt32LE(index, 0);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault_entry"), owner.toBuffer(), indexBuf],
    PROGRAM_ID
  )[0];
}

// ─── Walrus helpers ───────────────────────────────────────────────────────────

async function walrusUpload(data: string): Promise<string> {
  const bytes = new TextEncoder().encode(data);
  const res = await fetch(`${WALRUS_PUBLISHER}/v1/blobs?epochs=3`, {
    method: "PUT",
    headers: { "Content-Type": "application/octet-stream" },
    body: bytes,
  });
  if (!res.ok) throw new Error(`Walrus upload failed: ${res.status} ${await res.text()}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json = await res.json() as any;
  return json.newlyCreated?.blobObject?.blobId ?? json.alreadyCertified?.blobId;
}

async function walrusDownload(blobId: string): Promise<string> {
  const res = await fetch(`${WALRUS_AGGREGATOR}/v1/blobs/${blobId}`);
  if (!res.ok) throw new Error(`Walrus download failed: ${res.status}`);
  const buf = await res.arrayBuffer();
  return new TextDecoder().decode(buf);
}

// ─── Test runner ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>) {
  process.stdout.write(`  ${name} ... `);
  try {
    await fn();
    console.log("✓");
    passed++;
  } catch (err) {
    console.log(`✗\n    ${err instanceof Error ? err.message : String(err)}`);
    failed++;
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\nIkaVault integration tests");
  console.log(`  Signer : ${signer.publicKey.toBase58()}`);
  console.log(`  Program: ${PROGRAM_ID.toBase58()}`);
  console.log(`  Network: testnet\n`);

  const owner = signer.publicKey;
  const profilePDA = getUserProfilePDA(owner);

  // ── 1. Check SOL balance ──────────────────────────────────────────────────
  await test("signer has SOL balance", async () => {
    const balance = await connection.getBalance(owner);
    if (balance === 0) throw new Error("0 SOL — need devnet SOL to run tests");
    console.log(`(${(balance / 1e9).toFixed(4)} SOL)`);
  });

  // ── 2. Walrus upload + download ───────────────────────────────────────────
  let walrusBlobId = "";
  await test("Walrus: upload encrypted blob", async () => {
    const fakeEncrypted = `ikavault_test_${Date.now()}_encrypted_payload`;
    walrusBlobId = await walrusUpload(fakeEncrypted);
    if (!walrusBlobId) throw new Error("No blob ID returned");
    console.log(`(blobId: ${walrusBlobId.slice(0, 20)}...)`);
  });

  await test("Walrus: download and verify blob", async () => {
    if (!walrusBlobId) throw new Error("No blob ID from previous test");
    const downloaded = await walrusDownload(walrusBlobId);
    if (!downloaded.startsWith("ikavault_test_")) throw new Error(`Unexpected content: ${downloaded}`);
  });

  // ── 3. init_vault ─────────────────────────────────────────────────────────
  let vaultAlreadyExists = false;
  await test("init_vault: creates UserProfile PDA", async () => {
    const existing = await connection.getAccountInfo(profilePDA);
    if (existing) {
      vaultAlreadyExists = true;
      console.log("(already initialized — skipping)");
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tx = await (program.methods as any)
      .initVault("mock_dwallet_id_test", walrusBlobId || "mock_blob_id")
      .accounts({
        userProfile: profilePDA,
        owner,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log(`(tx: ${tx.slice(0, 20)}...)`);
  });

  // ── 4. Fetch UserProfile ──────────────────────────────────────────────────
  let entryCount = 0;
  await test("fetchUserProfile: reads on-chain PDA", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profile = await (program.account as any).userProfile.fetch(profilePDA);
    if (profile.owner.toBase58() !== owner.toBase58()) {
      throw new Error(`Owner mismatch: ${profile.owner.toBase58()}`);
    }
    entryCount = profile.entryCount;
    console.log(`(entryCount: ${entryCount}, dwalletId: ${profile.dwalletId})`);
  });

  // ── 5. add_entry ──────────────────────────────────────────────────────────
  const entryPDA = getVaultEntryPDA(owner, entryCount);
  await test("add_entry: stores credential pointer on-chain", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tx = await (program.methods as any)
      .addEntry(
        "GitHub Test",
        "https://github.com",
        "test@example.com",
        walrusBlobId || "mock_encrypted_blob_id"
      )
      .accounts({
        userProfile: profilePDA,
        vaultEntry: entryPDA,
        owner,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log(`(tx: ${tx.slice(0, 20)}...)`);
  });

  // ── 6. Fetch VaultEntry ───────────────────────────────────────────────────
  await test("fetchVaultEntry: reads stored credential", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entry = await (program.account as any).vaultEntry.fetch(entryPDA);
    if (entry.label !== "GitHub Test") throw new Error(`label: ${entry.label}`);
    if (entry.username !== "test@example.com") throw new Error(`username: ${entry.username}`);
    if (!entry.isActive) throw new Error("entry not active");
    console.log(`(label: "${entry.label}", active: ${entry.isActive})`);
  });

  // ── 7. delete_entry ───────────────────────────────────────────────────────
  await test("delete_entry: soft-deletes credential", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tx = await (program.methods as any)
      .deleteEntry(entryCount)
      .accounts({
        userProfile: profilePDA,
        vaultEntry: entryPDA,
        owner,
      })
      .rpc();
    console.log(`(tx: ${tx.slice(0, 20)}...)`);

    // Verify isActive = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entry = await (program.account as any).vaultEntry.fetch(entryPDA);
    if (entry.isActive) throw new Error("entry still active after delete");
  });

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("\nFatal error:", err);
  process.exit(1);
});
