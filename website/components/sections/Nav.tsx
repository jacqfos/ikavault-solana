"use client";

import Link from "next/link";
import { useState } from "react";

export function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-ink-950/60 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="font-display text-lg font-semibold">
          Ika<span className="text-mint">Vault</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          <Link href="/#how" className="text-sm text-white/70 hover:text-white">
            How it works
          </Link>
          <Link href="/#features" className="text-sm text-white/70 hover:text-white">
            Features
          </Link>
          <Link href="/#roadmap" className="text-sm text-white/70 hover:text-white">
            Roadmap
          </Link>
          <Link href="/pricing" className="text-sm text-white/70 hover:text-white">
            Pricing
          </Link>
          <Link href="/docs" className="text-sm text-white/70 hover:text-white">
            Docs
          </Link>
          <a
            href="https://github.com/jacqfos/ikavault-solana"
            target="_blank"
            rel="noreferrer"
            className="text-sm text-white/70 hover:text-white"
          >
            GitHub
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/pricing"
            className="rounded-full bg-mint px-4 py-1.5 text-sm font-medium text-ink-950 transition hover:bg-mint-soft"
          >
            Get Pro
          </Link>
          <button
            onClick={() => setOpen(!open)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 md:hidden"
            aria-label="Menu"
          >
            <div className="flex flex-col gap-1">
              <span className="h-0.5 w-4 bg-white" />
              <span className="h-0.5 w-4 bg-white" />
            </div>
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-white/5 bg-ink-950 md:hidden">
          <nav className="flex flex-col px-6 py-4">
            <Link href="/#how" className="py-2 text-sm text-white/80">
              How it works
            </Link>
            <Link href="/#features" className="py-2 text-sm text-white/80">
              Features
            </Link>
            <Link href="/pricing" className="py-2 text-sm text-white/80">
              Pricing
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
