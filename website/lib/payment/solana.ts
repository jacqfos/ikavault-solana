import {
  Connection,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

import { SOLANA_MINTS, TREASURY, type Stablecoin } from "../plans";

/**
 * Build an SPL stablecoin transfer (USDC or USDT) to the IkaVault treasury.
 *
 * If the treasury has no ATA for the chosen mint yet, we also create it in the
 * same tx — the payer funds the rent. Typical first-payment cost: ~0.002 SOL.
 *
 * `reference` is a disposable pubkey attached as a read-only key to the
 * transfer ix (Solana Pay pattern) so the client can poll for the signature
 * without the user copy-pasting a tx hash.
 */
export async function buildSolanaPaymentTx(args: {
  connection: Connection;
  payer: PublicKey;
  amountUsd: number;
  stablecoin: Stablecoin;
  reference: PublicKey;
}): Promise<Transaction> {
  const { connection, payer, amountUsd, stablecoin, reference } = args;

  const { mint: mintStr, decimals } = SOLANA_MINTS[stablecoin];
  const mint = new PublicKey(mintStr);
  const treasury = new PublicKey(TREASURY.solana);

  const payerAta = getAssociatedTokenAddressSync(mint, payer);
  const treasuryAta = getAssociatedTokenAddressSync(mint, treasury);

  const amountRaw = BigInt(Math.round(amountUsd * 10 ** decimals));

  const tx = new Transaction();

  // Create treasury ATA if it doesn't exist — payer pays rent.
  const treasuryAtaInfo = await connection.getAccountInfo(treasuryAta);
  if (!treasuryAtaInfo) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        payer,
        treasuryAta,
        treasury,
        mint,
      ),
    );
  }

  const transferIx = createTransferCheckedInstruction(
    payerAta,
    mint,
    treasuryAta,
    payer,
    amountRaw,
    decimals,
  );
  transferIx.keys.push({
    pubkey: reference,
    isSigner: false,
    isWritable: false,
  });
  tx.add(transferIx);

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();
  tx.feePayer = payer;
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;

  return tx;
}

/**
 * Poll RPC until we find a confirmed signature referencing `reference`.
 * Returns the signature string. Throws on timeout.
 */
export async function waitForSolanaPayment(args: {
  connection: Connection;
  reference: PublicKey;
  maxWaitMs?: number;
}): Promise<string> {
  const { connection, reference, maxWaitMs = 90_000 } = args;
  const started = Date.now();

  while (Date.now() - started < maxWaitMs) {
    const sigs = await connection.getSignaturesForAddress(reference, {
      limit: 1,
    });
    if (sigs.length > 0 && sigs[0].confirmationStatus === "confirmed") {
      return sigs[0].signature;
    }
    await sleep(1500);
  }
  throw new Error("Payment not confirmed within timeout");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
