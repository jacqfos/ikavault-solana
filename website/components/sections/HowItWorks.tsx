"use client";

import { motion } from "framer-motion";

const steps = [
  {
    n: "01",
    title: "Sign in with Google",
    body: "Web3Auth derives a Solana keypair from your Google login. No seed phrase. No extension install friction.",
    accent: "text-mint",
  },
  {
    n: "02",
    title: "Split-key encryption",
    body: "Ika's 2PC-MPC network generates a distributed keypair with you. Neither side ever holds the full key.",
    accent: "text-violet",
  },
  {
    n: "03",
    title: "Encrypted blob on Walrus",
    body: "Your vault is encrypted client-side, uploaded to Walrus, pointers written to Solana. Reads pull + decrypt on-device.",
    accent: "text-pink",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="relative py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-16 max-w-2xl">
          <div className="mb-3 font-mono text-xs text-mint">// FLOW</div>
          <h2 className="font-display text-4xl font-semibold leading-tight md:text-5xl">
            Three moves between you and a vault{" "}
            <span className="text-white/50">nobody can steal.</span>
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, delay: i * 0.12 }}
              className="gradient-border glass relative rounded-2xl p-6"
            >
              <div className={`font-mono text-sm ${s.accent}`}>{s.n}</div>
              <h3 className="mt-3 font-display text-xl font-semibold">
                {s.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-white/60">
                {s.body}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
