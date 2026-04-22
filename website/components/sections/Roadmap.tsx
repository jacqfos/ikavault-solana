"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

const items = [
  {
    week: "Week 1",
    date: "Apr 6 – 12",
    status: "done" as const,
    title: "Foundation",
    bullets: [
      "Anchor program scaffold + vault PDAs",
      "Web3Auth Google OAuth in extension",
      "Popup UI dark theme",
    ],
  },
  {
    week: "Week 2",
    date: "Apr 13 – 19",
    status: "done" as const,
    title: "Core crypto",
    bullets: [
      "Ika dWallet create/sign via gRPC",
      "Client-side encryption w/ split key",
      "Walrus upload/download wired",
    ],
  },
  {
    week: "Week 3",
    date: "Apr 20 – 26",
    status: "active" as const,
    title: "Flows + website",
    bullets: [
      "Save + autofill credential flow",
      "Vault listing + search UI",
      "Marketing site on Walrus Sites",
    ],
  },
  {
    week: "Week 4",
    date: "Apr 27 – May 3",
    status: "planned" as const,
    title: "Polish",
    bullets: [
      "Encrypt FHE integration (stretch)",
      "Share credential flow (stretch)",
      "Edge cases + loading states",
    ],
  },
  {
    week: "Week 5",
    date: "May 4 – 11",
    status: "planned" as const,
    title: "Submit",
    bullets: [
      "Demo video",
      "GitHub README",
      "Colosseum submission",
    ],
  },
];

export function Roadmap() {
  return (
    <section id="roadmap" className="py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-12 max-w-2xl">
          <div className="mb-3 font-mono text-xs text-mint">// ROADMAP</div>
          <h2 className="font-display text-4xl font-semibold leading-tight md:text-5xl">
            Built in public,{" "}
            <span className="text-white/50">week by week.</span>
          </h2>
          <p className="mt-4 text-white/60">
            Solana Frontier Hackathon · Apr 6 – May 11, 2026. Every commit,
            every week, every post-mortem in public.
          </p>
        </div>

        <ol className="relative space-y-4 border-l border-white/5 pl-6">
          {items.map((it, i) => (
            <motion.li
              key={it.week}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: i * 0.08 }}
              className="relative"
            >
              <span
                className={cn(
                  "absolute -left-[31px] top-2 h-3 w-3 rounded-full ring-2 ring-ink-950",
                  it.status === "done" && "bg-mint shadow-[0_0_14px_#7cffcb]",
                  it.status === "active" &&
                    "bg-violet shadow-[0_0_14px_#8b5cf6] animate-pulse",
                  it.status === "planned" && "bg-white/20"
                )}
              />
              <div className="rounded-2xl border border-white/5 bg-ink-900/40 p-6">
                <div className="flex flex-wrap items-baseline gap-3">
                  <span className="font-mono text-[11px] tracking-wider text-white/40">
                    {it.week.toUpperCase()}
                  </span>
                  <span className="font-mono text-[11px] text-white/30">
                    {it.date}
                  </span>
                  <StatusPill status={it.status} />
                </div>
                <h3 className="mt-2 font-display text-lg font-semibold">
                  {it.title}
                </h3>
                <ul className="mt-3 space-y-1 text-sm text-white/60">
                  {it.bullets.map((b) => (
                    <li key={b} className="flex gap-2">
                      <span className="text-mint/60">›</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function StatusPill({ status }: { status: "done" | "active" | "planned" }) {
  const label =
    status === "done" ? "Shipped" : status === "active" ? "In progress" : "Planned";
  const klass =
    status === "done"
      ? "text-mint border-mint/30 bg-mint/10"
      : status === "active"
      ? "text-violet border-violet/30 bg-violet/10"
      : "text-white/40 border-white/10 bg-white/5";
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider",
        klass
      )}
    >
      {label}
    </span>
  );
}
