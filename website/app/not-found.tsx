import Link from "next/link";

export default function NotFound() {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-ink-950 px-6">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,rgba(124,255,203,0.08),transparent_55%)]" />
      <div className="text-center">
        <div className="font-mono text-xs text-mint">// 0x404</div>
        <h1 className="mt-4 font-display text-6xl font-semibold md:text-7xl">
          Lost in the mempool.
        </h1>
        <p className="mt-4 max-w-md text-white/60">
          That route didn&apos;t make it on-chain. Try heading back to the
          homepage.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex rounded-full bg-mint px-6 py-3 font-medium text-ink-950 transition hover:bg-mint-soft"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
