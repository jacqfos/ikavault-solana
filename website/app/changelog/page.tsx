import { Nav } from "@/components/sections/Nav";
import { Footer } from "@/components/sections/Footer";

type Entry = {
  date: string;
  title: string;
  tag: "ship" | "fix" | "note";
  bullets: string[];
};

const entries: Entry[] = [
  {
    date: "2026-04-21",
    title: "Website v0.1 — landing + pricing",
    tag: "ship",
    bullets: [
      "Landing page with animated split-key hero",
      "Pricing + multi-chain checkout (SOL / SUI / IKA)",
      "Walrus Sites deploy config with SuiNS routing",
      "Docs + roadmap sections",
    ],
  },
  {
    date: "2026-04-20",
    title: "PIN unlock + share flows",
    tag: "ship",
    bullets: [
      "PinSetupView + PinUnlockView",
      "Encryption layer abstraction behind PIN",
      "EntryDetailView with copy + reveal",
    ],
  },
  {
    date: "2026-04-17",
    title: "Walrus upload/download integrated",
    tag: "ship",
    bullets: [
      "Encrypted blob upload via Staketab publisher",
      "Pointer stored in vault PDA",
      "Full round-trip: create → fetch → decrypt",
    ],
  },
  {
    date: "2026-04-14",
    title: "Anchor program scaffold + MV3 service worker",
    tag: "ship",
    bullets: [
      "init_vault / add_entry / update_entry / delete_entry / share_entry",
      "Service worker builds ixes manually (no Anchor wrapper in MV3)",
      "Web3Auth Google OAuth → Solana key working",
    ],
  },
  {
    date: "2026-04-12",
    title: "Hackathon kickoff",
    tag: "note",
    bullets: [
      "Colosseum Solana Frontier — Apr 6 – May 11",
      "Target track: Infrastructure / Consumer",
      "Gap analysis via Colosseum Copilot: partial gap — no competitor uses Ika + Walrus + FHE",
    ],
  },
];

const tagColor: Record<Entry["tag"], string> = {
  ship: "text-mint border-mint/30 bg-mint/10",
  fix: "text-violet border-violet/30 bg-violet/10",
  note: "text-pink border-pink/30 bg-pink/10",
};

export default function ChangelogPage() {
  return (
    <main className="relative min-h-screen pt-24">
      <Nav />
      <div className="absolute inset-x-0 top-0 -z-10 h-[480px] bg-[radial-gradient(ellipse_at_top,rgba(255,107,157,0.06),transparent_60%)]" />

      <article className="mx-auto max-w-3xl px-6 py-16">
        <div className="mb-10">
          <div className="font-mono text-xs text-pink">// CHANGELOG</div>
          <h1 className="mt-2 font-display text-4xl font-semibold md:text-5xl">
            What we shipped.
          </h1>
          <p className="mt-4 text-white/60">
            Every hackathon week. Every commit worth mentioning.
          </p>
        </div>

        <ol className="space-y-6">
          {entries.map((e) => (
            <li
              key={e.date}
              className="rounded-2xl border border-white/5 bg-ink-900/40 p-6"
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-[11px] text-white/40">
                  {e.date}
                </span>
                <span
                  className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${tagColor[e.tag]}`}
                >
                  {e.tag}
                </span>
              </div>
              <h2 className="mt-2 font-display text-xl font-semibold">
                {e.title}
              </h2>
              <ul className="mt-3 space-y-1 text-sm text-white/65">
                {e.bullets.map((b) => (
                  <li key={b} className="flex gap-2">
                    <span className="text-mint/60">›</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </article>

      <Footer />
    </main>
  );
}
