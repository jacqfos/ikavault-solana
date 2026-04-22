"use client";

import { motion } from "framer-motion";
import { Fingerprint, Share2, Search, Globe, ShieldCheck, Zap } from "lucide-react";

const features = [
  {
    icon: Fingerprint,
    title: "Autofill, on any site",
    body: "Content script matches URL, fetches blob, decrypts locally, fills the form. Never more than a keystroke.",
  },
  {
    icon: Share2,
    title: "Share a credential",
    body: "Re-encrypt for a recipient's dWallet pubkey. ACL on-chain. Revoke in one click.",
  },
  {
    icon: Search,
    title: "FHE encrypted search",
    body: "Search your vault without decrypting. Queries run on-chain over ciphertext via Encrypt FHE.",
  },
  {
    icon: Globe,
    title: "Cross-device, no sync server",
    body: "State lives on Solana + Walrus. Install on a second device — log in — vault appears.",
  },
  {
    icon: ShieldCheck,
    title: "No master password",
    body: "Your Google identity + Ika's network share replace a master password. Nothing to forget.",
  },
  {
    icon: Zap,
    title: "Built for speed",
    body: "Walrus fetch ~80ms. dWallet sign ~200ms. Autofill faster than you can tab.",
  },
];

export function Features() {
  return (
    <section className="py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-16 max-w-2xl">
          <div className="mb-3 font-mono text-xs text-violet">// FEATURES</div>
          <h2 className="font-display text-4xl font-semibold leading-tight md:text-5xl">
            What you get with IkaVault.
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className="group relative overflow-hidden rounded-2xl border border-white/5 bg-ink-900/40 p-6 transition hover:border-white/15 hover:bg-ink-800/60"
            >
              <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-mint/5 opacity-0 blur-2xl transition group-hover:opacity-100" />
              <f.icon className="h-6 w-6 text-mint" />
              <h3 className="mt-4 font-display text-lg font-semibold">
                {f.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-white/55">
                {f.body}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
