"use client";

import { Globe2 } from "lucide-react";

export function Dogfood() {
  return (
    <section className="relative py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="gradient-border glass relative overflow-hidden rounded-3xl p-10 md:p-14">
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-mint/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-violet/10 blur-3xl" />

          <div className="relative flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-mint/20 bg-mint/5 px-3 py-1 font-mono text-[11px] text-mint">
                <Globe2 className="h-3 w-3" />
                HOSTED ON WALRUS · SUINS
              </div>
              <h2 className="font-display text-3xl font-semibold leading-tight md:text-4xl">
                This site is <span className="text-mint">itself</span>{" "}
                decentralized.
              </h2>
              <p className="mt-4 text-white/60">
                ikavault.xyz doesn&apos;t live on Vercel or AWS. It&apos;s a
                Walrus Site, content-addressed on the Walrus network, routed via{" "}
                <span className="font-mono text-white">@ikavault.sui</span>{" "}
                (SuiNS). We dogfood the stack our users depend on.
              </p>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="rounded-lg border border-white/5 bg-ink-950/70 px-4 py-3">
                <div className="text-white/40">SuiNS</div>
                <div className="mt-1 text-mint">@ikavault.sui</div>
              </div>
              <div className="rounded-lg border border-white/5 bg-ink-950/70 px-4 py-3">
                <div className="text-white/40">Walrus site object</div>
                <div className="mt-1 truncate text-violet">
                  0x...pending-publish
                </div>
              </div>
              <div className="rounded-lg border border-white/5 bg-ink-950/70 px-4 py-3">
                <div className="text-white/40">Gateway</div>
                <div className="mt-1 text-pink">ikavault.walrus.site</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
