"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Github } from "lucide-react";
import { SplitKeyOrb } from "./SplitKeyOrb";

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-28 pb-40">
      {/* grid background */}
      <div className="absolute inset-0 -z-10 bg-grid-fade opacity-60" />
      <div className="absolute inset-x-0 top-0 -z-10 h-[480px] bg-[radial-gradient(ellipse_at_top,rgba(124,255,203,0.08),transparent_60%)]" />

      <div className="mx-auto grid max-w-6xl gap-12 px-6 md:grid-cols-2 md:items-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="relative"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-mint/20 bg-mint/5 px-3 py-1 font-mono text-xs text-mint">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-mint" />
            </span>
            LIVE · Solana Devnet · Ika Pre-Alpha
          </div>

          <h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
            Your passwords.
            <br />
            <span className="shine-text">Split</span> between you
            <br />
            and no one.
          </h1>

          <p className="mt-6 max-w-lg text-lg leading-relaxed text-white/60">
            IkaVault is a decentralized password manager built on Solana. Keys
            are split 2-of-2 between you and the Ika network — no server ever
            holds a complete key. Vault data lives encrypted on{" "}
            <span className="text-white">Walrus</span>, searchable on-chain via{" "}
            <span className="text-white">FHE</span>.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/pricing"
              className="group relative overflow-hidden rounded-full bg-mint px-6 py-3 font-medium text-ink-950 transition hover:bg-mint-soft"
            >
              <span className="relative z-10 inline-flex items-center gap-2">
                Get IkaVault Pro
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </span>
            </Link>
            <a
              href="#how"
              className="rounded-full border border-white/10 bg-white/5 px-6 py-3 font-medium text-white/90 backdrop-blur transition hover:bg-white/10"
            >
              How it works
            </a>
            <a
              href="https://github.com/jacqfos/ikavault-solana"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-5 py-3 font-medium text-white/80 transition hover:bg-white/5"
            >
              <Github className="h-4 w-4" />
              Source
            </a>
          </div>

          <div className="mt-10 grid grid-cols-3 gap-4 text-xs font-mono text-white/50">
            <div>
              <div className="text-mint">0-knowledge</div>
              <div className="mt-1">Server can&apos;t decrypt</div>
            </div>
            <div>
              <div className="text-violet">Walrus</div>
              <div className="mt-1">Decentralized blobs</div>
            </div>
            <div>
              <div className="text-pink">FHE</div>
              <div className="mt-1">Encrypted on-chain search</div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
          className="flex justify-center"
        >
          <SplitKeyOrb />
        </motion.div>
      </div>
    </section>
  );
}
