import { Nav } from "@/components/sections/Nav";
import { Pricing } from "@/components/payment/Pricing";
import { Footer } from "@/components/sections/Footer";

export default function PricingPage() {
  return (
    <main className="relative min-h-screen pt-24">
      <Nav />
      <div className="absolute inset-x-0 top-0 -z-10 h-[480px] bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.08),transparent_60%)]" />
      <Pricing />
      <FAQ />
      <Footer />
    </main>
  );
}

function FAQ() {
  const items = [
    {
      q: "What is the IkaVault Pro Pass?",
      a: "A stablecoin payment (USDC or USDT) to the IkaVault treasury. The tx is your proof of purchase — the extension reads it from-chain to unlock Pro features. No custom program, no NFT contract to audit.",
    },
    {
      q: "Why USDC and USDT instead of SOL or SUI?",
      a: "Stable USD pricing means the Pro Pass costs the same whether SOL pumps or dumps. You get predictable checkout, we get predictable treasury. SPL token transfers on Solana and PTB transfers on Sui are still pure wallet-signed moves — no custom program involved.",
    },
    {
      q: "Annual vs Lifetime — what's the difference?",
      a: "Annual unlocks Pro for 365 days after the tx is confirmed; you re-pay manually when it lapses. Lifetime never expires. Both are one-time transfers — there's no auto-debit, no recurring billing, no card on file.",
    },
    {
      q: "Can I pay in IKA?",
      a: "Not yet. USDC and USDT aren't live on the Ika pre-alpha network. The Ika option will light up when its mainnet and stablecoin bridges go live.",
    },
    {
      q: "What if I lose access to my wallet?",
      a: "The pass is attached to the paying wallet. We recommend using the Web3Auth embedded wallet — it's tied to your Google login, so you can recover it from a fresh device.",
    },
    {
      q: "Why does the site itself run on Walrus?",
      a: "We host the marketing site on Walrus Sites, routed via @ikavault.sui (SuiNS). The site has no Vercel or AWS dependency — the same decentralized stack our users rely on.",
    },
    {
      q: "Is the extension open source?",
      a: "Yes. Anchor program, Rust client, and TypeScript extension — all public on GitHub.",
    },
  ];

  return (
    <section className="py-24">
      <div className="mx-auto max-w-3xl px-6">
        <div className="mb-10">
          <div className="font-mono text-xs text-pink">// FAQ</div>
          <h2 className="mt-2 font-display text-3xl font-semibold md:text-4xl">
            Questions.
          </h2>
        </div>
        <div className="divide-y divide-white/5 rounded-2xl border border-white/5 bg-ink-900/40">
          {items.map((it) => (
            <details
              key={it.q}
              className="group px-6 py-5 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer items-center justify-between font-display text-base font-medium">
                {it.q}
                <span className="text-mint transition group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-white/60">
                {it.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
