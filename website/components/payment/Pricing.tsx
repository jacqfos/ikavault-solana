"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";

import { cn } from "@/lib/cn";
import { PLANS, type Plan, type Term } from "@/lib/plans";
import { useChainPreference } from "@/lib/useChainPreference";
import { ChainSelector } from "./ChainSelector";
import { PaymentModal } from "./PaymentModal";

export function Pricing() {
  const [chain, setChain] = useChainPreference("solana");
  const [term, setTerm] = useState<Term>("lifetime");
  const [checkoutPlan, setCheckoutPlan] = useState<Plan | null>(null);

  return (
    <section id="pricing" className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-10 flex flex-col items-start gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl">
            <div className="mb-3 font-mono text-xs text-mint">// PRICING</div>
            <h2 className="font-display text-4xl font-semibold leading-tight md:text-5xl">
              Pay in stablecoins. Vault on your terms.
            </h2>
            <p className="mt-4 text-white/60">
              One flat USD price, paid in{" "}
              <span className="text-white">USDC or USDT</span> on Solana or Sui.
              No master password, no subscription, no surprises.
            </p>
          </div>

          <div className="w-full space-y-3 md:w-[420px]">
            <div>
              <div className="mb-2 font-mono text-[11px] text-white/40">
                PAY WITH
              </div>
              <ChainSelector value={chain} onChange={setChain} />
            </div>
            <div>
              <div className="mb-2 font-mono text-[11px] text-white/40">
                TERM
              </div>
              <TermToggle value={term} onChange={setTerm} />
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {PLANS.map((plan, i) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className={cn(
                "relative flex flex-col rounded-2xl border p-8",
                plan.highlight
                  ? "gradient-border glass shadow-[0_0_60px_-20px_#7cffcb55]"
                  : "border-white/5 bg-ink-900/40",
              )}
            >
              {plan.highlight && (
                <div className="absolute -top-3 right-6 rounded-full bg-mint px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-ink-950">
                  Most loved
                </div>
              )}

              <div className="font-mono text-xs text-white/40">
                {plan.id.toUpperCase()}
              </div>
              <h3 className="mt-2 font-display text-2xl font-semibold">
                {plan.name}
              </h3>
              <p className="mt-1 text-sm text-white/55">{plan.tagline}</p>

              <PlanPrice plan={plan} term={term} />

              <ul className="mt-6 space-y-2.5 text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 flex-none text-mint" />
                    <span className="text-white/80">{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                {plan.id === "free" ? (
                  <a
                    href="#"
                    className="block rounded-full border border-white/10 px-5 py-3 text-center font-medium text-white/80 transition hover:bg-white/5"
                  >
                    Install extension
                  </a>
                ) : (
                  <button
                    onClick={() => setCheckoutPlan(plan)}
                    className={cn(
                      "block w-full rounded-full px-5 py-3 text-center font-medium transition",
                      plan.highlight
                        ? "bg-mint text-ink-950 hover:bg-mint-soft"
                        : "border border-white/15 bg-white/5 text-white hover:bg-white/10",
                    )}
                  >
                    Get {plan.name}
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        <p className="mt-8 text-center font-mono text-xs text-white/40">
          No subscriptions · No card on file · Wallet signs, chain verifies.
        </p>
      </div>

      {checkoutPlan && (
        <PaymentModal
          open={!!checkoutPlan}
          onClose={() => setCheckoutPlan(null)}
          plan={checkoutPlan}
          chain={chain}
          term={term}
        />
      )}
    </section>
  );
}

function PlanPrice({ plan, term }: { plan: Plan; term: Term }) {
  if (plan.id === "free") {
    return (
      <>
        <div className="mt-6 flex items-baseline gap-2">
          <span className="font-display text-4xl font-semibold">$0</span>
        </div>
        <div className="font-mono text-[11px] text-white/40">forever free</div>
      </>
    );
  }
  const price = plan.terms[term];
  if (!price) {
    return (
      <>
        <div className="mt-6 flex items-baseline gap-2">
          <span className="font-display text-4xl font-semibold text-white/40">
            —
          </span>
        </div>
      </>
    );
  }
  return (
    <>
      <div className="mt-6 flex items-baseline gap-2">
        <span className="font-display text-4xl font-semibold">${price.usd}</span>
        <span className="font-mono text-sm text-mint">USD</span>
      </div>
      <div className="font-mono text-[11px] text-white/40">
        {term === "lifetime"
          ? "one-time · lifetime pass"
          : "one year · renew anytime"}
      </div>
    </>
  );
}

function TermToggle({
  value,
  onChange,
}: {
  value: Term;
  onChange: (t: Term) => void;
}) {
  const options: Array<{ id: Term; label: string; hint: string }> = [
    { id: "annual", label: "Annual", hint: "1 year access" },
    { id: "lifetime", label: "Lifetime", hint: "one-time, forever" },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-ink-900/60 p-1.5">
      {options.map((o) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={cn(
              "relative rounded-xl px-4 py-2.5 text-left transition",
              active
                ? "bg-gradient-to-br from-mint/20 via-violet/10 to-pink/10 text-white shadow-inner shadow-mint/10"
                : "text-white/60 hover:bg-white/5 hover:text-white",
            )}
          >
            <div className="font-display text-sm font-semibold">{o.label}</div>
            <div
              className={cn(
                "mt-0.5 font-mono text-[10px] tracking-wider",
                active ? "text-mint" : "text-white/40",
              )}
            >
              {o.hint}
            </div>
            {active && (
              <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-mint/30" />
            )}
          </button>
        );
      })}
    </div>
  );
}
