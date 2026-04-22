"use client";

import { cn } from "@/lib/cn";
import { CHAINS, type Chain } from "@/lib/plans";

export function ChainSelector({
  value,
  onChange,
}: {
  value: Chain;
  onChange: (c: Chain) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-ink-900/60 p-1.5">
      {CHAINS.map((c) => {
        const active = value === c.id;
        const disabled = !c.enabled;
        return (
          <button
            key={c.id}
            onClick={() => !disabled && onChange(c.id)}
            disabled={disabled}
            title={disabled ? c.comingSoonNote : undefined}
            className={cn(
              "relative rounded-xl px-4 py-2.5 text-left transition",
              disabled && "cursor-not-allowed opacity-50",
              !disabled &&
                (active
                  ? "bg-gradient-to-br from-mint/20 via-violet/10 to-pink/10 text-white shadow-inner shadow-mint/10"
                  : "text-white/60 hover:bg-white/5 hover:text-white"),
            )}
          >
            <div
              className={cn(
                "font-mono text-[10px] tracking-wider",
                !disabled && active ? "text-mint" : "text-white/40",
              )}
            >
              {c.short}
            </div>
            <div className="mt-0.5 font-display text-sm font-semibold">
              {c.name}
            </div>
            {disabled && (
              <div className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-white/40">
                Soon
              </div>
            )}
            {!disabled && active && (
              <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-mint/30" />
            )}
          </button>
        );
      })}
    </div>
  );
}
