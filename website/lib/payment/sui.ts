import { Transaction } from "@mysten/sui/transactions";
import { SUI_COIN_TYPES, TREASURY, type Stablecoin } from "../plans";

// Minimal surface we actually use — avoids type drift between @mysten/sui's
// SuiClient and dapp-kit's SuiJsonRpcClient. They share these methods.
interface SuiRpc {
  getCoinMetadata: (args: {
    coinType: string;
  }) => Promise<{ decimals: number } | null>;
  getCoins: (args: {
    owner: string;
    coinType: string;
  }) => Promise<{ data: Array<{ coinObjectId: string }> }>;
}

export async function buildSuiPaymentTx(args: {
  client: SuiRpc;
  sender: string;
  amountUsd: number;
  stablecoin: Stablecoin;
}): Promise<Transaction> {
  const { client, sender, amountUsd, stablecoin } = args;
  const coinType = SUI_COIN_TYPES[stablecoin];

  const decimals = await getCoinDecimals(client, coinType);
  const raw = BigInt(Math.round(amountUsd * 10 ** decimals));

  const tx = new Transaction();
  tx.setSender(sender);

  const coins = await client.getCoins({ owner: sender, coinType });
  if (!coins.data.length) {
    throw new Error(
      `No ${stablecoin.toUpperCase()} coins found in wallet. Bridge or swap first.`,
    );
  }
  const primary = tx.object(coins.data[0].coinObjectId);
  if (coins.data.length > 1) {
    tx.mergeCoins(
      primary,
      coins.data.slice(1).map((c) => tx.object(c.coinObjectId)),
    );
  }
  const [payCoin] = tx.splitCoins(primary, [raw]);
  tx.transferObjects([payCoin], TREASURY.sui);

  return tx;
}

async function getCoinDecimals(
  client: SuiRpc,
  coinType: string,
): Promise<number> {
  try {
    const meta = await client.getCoinMetadata({ coinType });
    return meta?.decimals ?? 6;
  } catch {
    return 6;
  }
}
