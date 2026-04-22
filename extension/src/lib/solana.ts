/// Solana program interaction layer.
///
/// We build Anchor instructions manually (borsh serialization of args +
/// explicit account metas) instead of going through the Anchor Program
/// wrapper. The wrapper's account-resolver and buffer-layout path was
/// raising "Blob.encode[data] requires (length 32) Buffer as src" in the
/// MV3 service-worker bundle. Manual instruction construction is trivial
/// for our three instructions and bypasses the whole proxy chain.

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  Keypair,
  SystemProgram,
} from "@solana/web3.js";
import type { VaultEntry, UserProfile } from "./types";

export const SOLANA_RPC = "https://api.devnet.solana.com";
export const PROGRAM_ID = new PublicKey(
  "4y4f3BWjnCwAMw7eumBhLveJ6Uvv5i2qdgLCH3Nem6kf"
);

export const connection = new Connection(SOLANA_RPC, "confirmed");

// ─── Instruction discriminators (from IDL) ────────────────────────────────────

const DISC_INIT_VAULT = Buffer.from([77, 79, 85, 150, 33, 217, 52, 106]);
const DISC_ADD_ENTRY = Buffer.from([170, 45, 66, 212, 251, 230, 45, 38]);
const DISC_DELETE_ENTRY = Buffer.from([227, 198, 83, 191, 70, 23, 194, 58]);

// ─── Borsh primitives ─────────────────────────────────────────────────────────

function encU32(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n, 0);
  return b;
}

function encString(s: string): Buffer {
  const body = Buffer.from(s, "utf8");
  return Buffer.concat([encU32(body.length), body]);
}

function encBytes(bytes: ArrayLike<number> | Uint8Array): Buffer {
  const body = Buffer.from(bytes as Uint8Array);
  return Buffer.concat([encU32(body.length), body]);
}

// ─── PDA Derivation ───────────────────────────────────────────────────────────

export function getUserProfilePDA(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("user_profile"), owner.toBuffer()],
    PROGRAM_ID
  );
}

export function getVaultEntryPDA(
  owner: PublicKey,
  index: number
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault_entry"), owner.toBuffer(), encU32(index)],
    PROGRAM_ID
  );
}

export function getSharedEntryPDA(
  owner: PublicKey,
  recipient: PublicKey,
  entryIndex: number
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("shared_entry"),
      owner.toBuffer(),
      recipient.toBuffer(),
      encU32(entryIndex),
    ],
    PROGRAM_ID
  );
}

// ─── Transaction sender ───────────────────────────────────────────────────────

async function sendIx(ix: TransactionInstruction, keypair: Keypair): Promise<string> {
  const tx = new Transaction().add(ix);
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = keypair.publicKey;
  tx.sign(keypair);

  const sig = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });
  await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
  return sig;
}

// ─── Write Instructions ───────────────────────────────────────────────────────

/**
 * Initialize a new user vault on-chain. Creates the UserProfile PDA.
 */
export async function initVault(
  owner: PublicKey,
  keypair: Keypair,
  dwalletId: string,
  initialBlobId: string
): Promise<string> {
  const [userProfilePda] = getUserProfilePDA(owner);

  const data = Buffer.concat([
    DISC_INIT_VAULT,
    encString(dwalletId),
    encString(initialBlobId),
  ]);

  const ix = new TransactionInstruction({
    keys: [
      { pubkey: userProfilePda, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  });

  return sendIx(ix, keypair);
}

/**
 * Add a new credential entry on-chain (pointer to Walrus encrypted blob).
 */
export async function addEntry(
  owner: PublicKey,
  keypair: Keypair,
  params: {
    label: string;
    url: string;
    username: string;
    encryptedBlobId: string;
    entryIndex: number;
    encryptedUrlHash?: number[];
  }
): Promise<string> {
  const [userProfilePda] = getUserProfilePDA(owner);
  const [vaultEntryPda] = getVaultEntryPDA(owner, params.entryIndex);

  const data = Buffer.concat([
    DISC_ADD_ENTRY,
    encString(params.label),
    encString(params.url),
    encString(params.username),
    encString(params.encryptedBlobId),
    encBytes(params.encryptedUrlHash ?? []),
  ]);

  const ix = new TransactionInstruction({
    keys: [
      { pubkey: userProfilePda, isSigner: false, isWritable: true },
      { pubkey: vaultEntryPda, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  });

  return sendIx(ix, keypair);
}

/**
 * Soft-delete a credential entry on-chain.
 */
export async function deleteEntry(
  owner: PublicKey,
  keypair: Keypair,
  entryIndex: number
): Promise<string> {
  const [userProfilePda] = getUserProfilePDA(owner);
  const [vaultEntryPda] = getVaultEntryPDA(owner, entryIndex);

  const data = Buffer.concat([DISC_DELETE_ENTRY, encU32(entryIndex)]);

  const ix = new TransactionInstruction({
    keys: [
      { pubkey: userProfilePda, isSigner: false, isWritable: true },
      { pubkey: vaultEntryPda, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: true },
    ],
    programId: PROGRAM_ID,
    data,
  });

  return sendIx(ix, keypair);
}

// ─── Account Fetch (manual borsh deserialization) ─────────────────────────────

/**
 * Fetch user profile from on-chain PDA.
 * Layout: discriminator(8) owner(32) dwallet_id(string) vault_blob_id(string)
 *         entry_count(u32) updated_at(i64) bump(u8)
 */
export async function fetchUserProfile(
  owner: PublicKey
): Promise<UserProfile | null> {
  const [pda] = getUserProfilePDA(owner);
  const info = await connection.getAccountInfo(pda);
  if (!info) return null;

  const data = info.data;
  let offset = 8 + 32; // discriminator + owner pubkey

  const dwalletIdLen = data.readUInt32LE(offset); offset += 4;
  const dwalletId = data.slice(offset, offset + dwalletIdLen).toString("utf8"); offset += dwalletIdLen;

  const blobIdLen = data.readUInt32LE(offset); offset += 4;
  const vaultBlobId = data.slice(offset, offset + blobIdLen).toString("utf8"); offset += blobIdLen;

  const entryCount = data.readUInt32LE(offset); offset += 4;
  const updatedAt = Number(data.readBigInt64LE(offset));

  return { owner: owner.toBase58(), dwalletId, vaultBlobId, entryCount, updatedAt };
}

/**
 * Fetch all vault entries for a user (active + inactive, caller filters).
 */
export async function fetchVaultEntries(
  owner: PublicKey,
  entryCount: number
): Promise<VaultEntry[]> {
  const entries: VaultEntry[] = [];

  for (let i = 0; i < entryCount; i++) {
    const [pda] = getVaultEntryPDA(owner, i);
    const info = await connection.getAccountInfo(pda);
    if (!info) continue;

    const entry = deserializeVaultEntry(info.data, i);
    if (entry?.isActive) entries.push(entry);
  }

  return entries;
}

/**
 * VaultEntry layout:
 *   discriminator(8) owner(32) index(u32) label(string) url(string)
 *   encrypted_url_hash(bytes) username(string) encrypted_blob_id(string)
 *   is_active(bool) created_at(i64) updated_at(i64) bump(u8)
 */
function deserializeVaultEntry(data: Buffer, index: number): VaultEntry | null {
  try {
    let offset = 8 + 32 + 4; // discriminator + owner + index

    const labelLen = data.readUInt32LE(offset); offset += 4;
    const label = data.slice(offset, offset + labelLen).toString("utf8"); offset += labelLen;

    const urlLen = data.readUInt32LE(offset); offset += 4;
    const url = data.slice(offset, offset + urlLen).toString("utf8"); offset += urlLen;

    const encUrlHashLen = data.readUInt32LE(offset); offset += 4;
    const encryptedUrlHash = Array.from(data.slice(offset, offset + encUrlHashLen));
    offset += encUrlHashLen;

    const usernameLen = data.readUInt32LE(offset); offset += 4;
    const username = data.slice(offset, offset + usernameLen).toString("utf8"); offset += usernameLen;

    const blobIdLen = data.readUInt32LE(offset); offset += 4;
    const encryptedBlobId = data.slice(offset, offset + blobIdLen).toString("utf8"); offset += blobIdLen;

    const isActive = data[offset] === 1; offset += 1;
    const createdAt = Number(data.readBigInt64LE(offset)); offset += 8;
    const updatedAt = Number(data.readBigInt64LE(offset));

    return {
      index, label, url, username, encryptedBlobId,
      encryptedUrlHash, isActive, createdAt, updatedAt,
    };
  } catch {
    return null;
  }
}
