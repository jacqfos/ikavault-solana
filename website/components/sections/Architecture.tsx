"use client";

export function Architecture() {
  return (
    <section className="py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-12 max-w-2xl">
          <div className="mb-3 font-mono text-xs text-pink">// STACK</div>
          <h2 className="font-display text-4xl font-semibold leading-tight md:text-5xl">
            Four protocols. One vault.
          </h2>
        </div>

        <div className="gradient-border glass rounded-3xl p-8 md:p-12">
          <div className="grid gap-6 md:grid-cols-4">
            <StackCard
              label="AUTH"
              title="Web3Auth"
              body="Google OAuth → ed25519 Solana key, no seed phrase"
              color="text-mint"
            />
            <StackCard
              label="SIGNING"
              title="Ika 2PC-MPC"
              body="Split-key EdDSA, user share + network share"
              color="text-violet"
            />
            <StackCard
              label="STORAGE"
              title="Walrus"
              body="Decentralized encrypted blobs, content-addressed"
              color="text-pink"
            />
            <StackCard
              label="COMPUTE"
              title="Encrypt FHE"
              body="On-chain search over ciphertext, no decrypt"
              color="text-mint"
            />
          </div>

          <div className="mt-10 overflow-x-auto rounded-xl border border-white/5 bg-ink-950/50 p-6 font-mono text-xs text-white/70">
            <pre className="whitespace-pre leading-relaxed">
{`┌────────── Browser Extension (React + TS) ─────────┐
│   Web3Auth ←→  popup  ←→  background (service worker) │
│                    │                                │
│           ┌────────┴────────┐                       │
│           ▼                 ▼                       │
│   Ika dWallet (2PC)   Solana Program (Anchor)      │
│           │                 │                       │
│           ▼                 ▼                       │
│      split-key          vault PDAs                  │
│      encrypt/sign       pointers + ACL              │
│           │                 │                       │
│           └───────┬─────────┘                       │
│                   ▼                                 │
│              Walrus blobs                           │
│         (encrypted vault data)                      │
└─────────────────────────────────────────────────────┘`}
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}

function StackCard({
  label,
  title,
  body,
  color,
}: {
  label: string;
  title: string;
  body: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-ink-950/60 p-5">
      <div className={`font-mono text-[10px] tracking-wider ${color}`}>
        {label}
      </div>
      <div className="mt-2 font-display text-lg font-semibold">{title}</div>
      <div className="mt-2 text-xs leading-relaxed text-white/55">{body}</div>
    </div>
  );
}
