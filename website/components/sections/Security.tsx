"use client";

import { Lock, Eye, Users, KeyRound } from "lucide-react";

const tenets = [
  {
    icon: Lock,
    title: "No single party can decrypt",
    body: "Your vault key is split 2-of-2. Ika's network holds one share, your device holds the other. Neither alone can read your vault.",
  },
  {
    icon: Eye,
    title: "Zero-knowledge storage",
    body: "Walrus stores encrypted blobs. The storage layer never sees plaintext, URLs, or usernames — just opaque bytes.",
  },
  {
    icon: KeyRound,
    title: "No master password to forget",
    body: "Your Google identity via Web3Auth + Ika's network share replace the master password. Nothing to lose, nothing to brute-force.",
  },
  {
    icon: Users,
    title: "You sign, chain verifies",
    body: "Every vault mutation is an on-chain tx signed by the 2PC-MPC protocol. History is public, contents stay private.",
  },
];

export function Security() {
  return (
    <section id="security" className="py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-12 max-w-2xl">
          <div className="mb-3 font-mono text-xs text-pink">// TRUST MODEL</div>
          <h2 className="font-display text-4xl font-semibold leading-tight md:text-5xl">
            Four assumptions.{" "}
            <span className="text-white/50">Zero master secrets.</span>
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {tenets.map((t) => (
            <div
              key={t.title}
              className="flex gap-4 rounded-2xl border border-white/5 bg-ink-900/40 p-6"
            >
              <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-mint/10 text-mint ring-1 ring-mint/20">
                <t.icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold">
                  {t.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-white/60">
                  {t.body}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-pink/20 bg-pink/5 p-5 text-sm text-pink-soft">
          <strong className="font-mono text-xs uppercase tracking-wider text-pink">
            Pre-alpha notice ·
          </strong>{" "}
          Ika Solana SDK is pre-alpha. MPC signer is mocked, on-chain state may
          wipe. For hackathon demo only. Do not store real-world credentials
          yet.
        </div>
      </div>
    </section>
  );
}
