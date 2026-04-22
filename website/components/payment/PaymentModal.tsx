"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, X, Copy, ExternalLink } from "lucide-react";
import { Keypair } from "@solana/web3.js";
import {
  useConnection,
  useWallet,
} from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import {
  ConnectButton,
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";

import { cn } from "@/lib/cn";
import {
  STABLECOINS,
  type Chain,
  type Plan,
  type Stablecoin,
  type Term,
} from "@/lib/plans";
import { buildSolanaPaymentTx, waitForSolanaPayment } from "@/lib/payment/solana";
import { buildSuiPaymentTx } from "@/lib/payment/sui";

type Phase = "idle" | "building" | "signing" | "confirming" | "done" | "error";

export function PaymentModal({
  open,
  onClose,
  plan,
  chain,
  term,
}: {
  open: boolean;
  onClose: () => void;
  plan: Plan;
  chain: Chain;
  term: Term;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [stablecoin, setStablecoin] = useState<Stablecoin>("usdc");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const price = plan.terms[term];

  // Solana wiring
  const { connection } = useConnection();
  const solWallet = useWallet();

  // Sui wiring
  const suiClient = useSuiClient();
  const suiAccount = useCurrentAccount();
  const { mutateAsync: suiSignAndExecute } = useSignAndExecuteTransaction();

  // Per-open reference keypair for the Solana Pay style reference-match flow.
  const reference = useMemo(() => Keypair.generate().publicKey, [open]);

  const ikaDisabled = chain === "ika";

  async function payWithSolana() {
    if (!price) return;
    if (!solWallet.publicKey || !solWallet.signTransaction) {
      setError("Connect your Solana wallet first");
      return;
    }
    try {
      setError(null);
      setPhase("building");
      const tx = await buildSolanaPaymentTx({
        connection,
        payer: solWallet.publicKey,
        amountUsd: price.usd,
        stablecoin,
        reference,
      });
      setPhase("signing");
      const signed = await solWallet.signTransaction(tx);
      setPhase("confirming");
      const sig = await connection.sendRawTransaction(signed.serialize());
      const confirmed = await waitForSolanaPayment({
        connection,
        reference,
      }).catch(() => sig);
      setTxHash(confirmed);
      setPhase("done");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Payment failed");
      setPhase("error");
    }
  }

  async function payWithSui() {
    if (!price) return;
    if (!suiAccount) {
      setError("Connect your Sui wallet first");
      return;
    }
    try {
      setError(null);
      setPhase("building");
      const tx = await buildSuiPaymentTx({
        client: suiClient,
        sender: suiAccount.address,
        amountUsd: price.usd,
        stablecoin,
      });
      setPhase("signing");
      const result = await suiSignAndExecute({ transaction: tx });
      setPhase("confirming");
      setTxHash(result.digest);
      setPhase("done");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Payment failed");
      setPhase("error");
    }
  }

  async function handlePay() {
    if (chain === "solana") return payWithSolana();
    if (chain === "sui") return payWithSui();
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 20 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[101] grid place-items-center p-4"
          >
            <div className="gradient-border glass relative w-full max-w-md rounded-3xl bg-ink-900/90 p-8">
              <button
                onClick={onClose}
                className="absolute right-5 top-5 rounded-full p-1 text-white/50 hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="mb-6">
                <div className="font-mono text-xs text-mint">// CHECKOUT</div>
                <h3 className="mt-2 font-display text-2xl font-semibold">
                  {plan.passName}
                </h3>
                <p className="mt-1 text-sm text-white/55">
                  {term === "lifetime"
                    ? "Lifetime access. One-time payment."
                    : "One year access. Renew manually."}
                </p>
              </div>

              {/* Stablecoin selector */}
              {!ikaDisabled && (
                <div className="mb-5">
                  <div className="mb-2 font-mono text-[11px] text-white/40">
                    STABLECOIN
                  </div>
                  <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-ink-950/60 p-1.5">
                    {STABLECOINS.map((s) => {
                      const active = stablecoin === s.id;
                      return (
                        <button
                          key={s.id}
                          onClick={() => setStablecoin(s.id)}
                          className={cn(
                            "rounded-xl px-4 py-2 text-left transition",
                            active
                              ? "bg-gradient-to-br from-mint/20 via-violet/10 to-pink/10 text-white shadow-inner shadow-mint/10"
                              : "text-white/60 hover:bg-white/5 hover:text-white",
                          )}
                        >
                          <div
                            className={cn(
                              "font-mono text-[10px] tracking-wider",
                              active ? "text-mint" : "text-white/40",
                            )}
                          >
                            {s.short}
                          </div>
                          <div className="mt-0.5 font-display text-xs font-semibold">
                            {s.name}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mb-6 rounded-2xl border border-white/5 bg-ink-950/60 p-5">
                <div className="flex items-baseline justify-between">
                  <span className="text-white/60">Total</span>
                  <div className="text-right">
                    <div className="font-display text-3xl font-semibold">
                      ${price?.usd ?? "—"}{" "}
                      <span className="text-mint">
                        {stablecoin.toUpperCase()}
                      </span>
                    </div>
                    <div className="mt-1 font-mono text-xs text-white/40">
                      on{" "}
                      {chain === "solana"
                        ? "Solana"
                        : chain === "sui"
                          ? "Sui"
                          : "Ika"}
                    </div>
                  </div>
                </div>
              </div>

              {ikaDisabled ? (
                <div className="rounded-2xl border border-violet/30 bg-violet/5 p-5 text-center">
                  <div className="font-display text-sm font-semibold text-white">
                    Ika payments coming soon
                  </div>
                  <p className="mt-2 text-xs text-white/60">
                    USDC and USDT aren&apos;t live on the Ika pre-alpha
                    network yet. Switch to Solana or Sui to pay today.
                  </p>
                </div>
              ) : (
                <>
                  {/* wallet connect */}
                  <div className="mb-5">
                    {chain === "solana" ? (
                      <WalletMultiButton
                        style={{
                          width: "100%",
                          borderRadius: "999px",
                          background: "#13131a",
                          border: "1px solid rgba(255,255,255,0.1)",
                          color: "#fff",
                          fontFamily: "inherit",
                          height: "44px",
                        }}
                      />
                    ) : (
                      <div className="flex w-full justify-center">
                        <ConnectButton />
                      </div>
                    )}
                  </div>

                  {/* Pay button */}
                  <button
                    onClick={handlePay}
                    disabled={
                      phase === "building" ||
                      phase === "signing" ||
                      phase === "confirming" ||
                      phase === "done"
                    }
                    className="group relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-mint font-medium text-ink-950 transition hover:bg-mint-soft disabled:opacity-60"
                  >
                    {phase === "idle" && (
                      <>
                        Pay ${price?.usd} {stablecoin.toUpperCase()}
                      </>
                    )}
                    {phase === "building" && (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Building
                        tx…
                      </>
                    )}
                    {phase === "signing" && (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Awaiting
                        signature…
                      </>
                    )}
                    {phase === "confirming" && (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Confirming
                        on-chain…
                      </>
                    )}
                    {phase === "done" && (
                      <>
                        <Check className="h-4 w-4" /> Payment confirmed
                      </>
                    )}
                    {phase === "error" && <>Retry payment</>}
                  </button>
                </>
              )}

              {error && (
                <div className="mt-4 rounded-xl border border-pink/30 bg-pink/5 p-3 text-xs text-pink-soft">
                  {error}
                </div>
              )}

              {txHash && (
                <div className="mt-5 rounded-xl border border-white/5 bg-ink-950/60 p-4">
                  <div className="font-mono text-[10px] text-white/40">
                    TX SIGNATURE
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="truncate font-mono text-xs text-mint">
                      {txHash}
                    </code>
                    <button
                      onClick={() => navigator.clipboard.writeText(txHash)}
                      className="rounded-md p-1 text-white/60 hover:bg-white/10 hover:text-white"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <a
                      href={explorerUrl(chain, txHash)}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md p-1 text-white/60 hover:bg-white/10 hover:text-white"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              )}

              <p className="mt-5 text-center font-mono text-[10px] text-white/30">
                Verified client-side · RPC poll · No server
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function explorerUrl(chain: Chain, hash: string) {
  if (chain === "solana")
    return `https://explorer.solana.com/tx/${hash}`;
  if (chain === "sui") return `https://suiscan.xyz/mainnet/tx/${hash}`;
  return "#";
}
