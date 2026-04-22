import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-white/5 py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="font-display text-xl font-semibold">
            Ika<span className="text-mint">Vault</span>
          </div>
          <div className="mt-2 font-mono text-xs text-white/40">
            Built for Solana Frontier Hackathon · 2026
          </div>
        </div>

        <div className="grid grid-cols-3 gap-8 text-sm">
          <div className="space-y-2">
            <div className="font-mono text-xs text-white/40">PRODUCT</div>
            <Link href="/pricing" className="block text-white/70 hover:text-white">
              Pricing
            </Link>
            <Link href="/#how" className="block text-white/70 hover:text-white">
              How it works
            </Link>
            <Link href="/docs" className="block text-white/70 hover:text-white">
              Docs
            </Link>
            <Link href="/changelog" className="block text-white/70 hover:text-white">
              Changelog
            </Link>
          </div>
          <div className="space-y-2">
            <div className="font-mono text-xs text-white/40">PROTOCOL</div>
            <a href="https://ika.xyz" className="block text-white/70 hover:text-white">
              Ika
            </a>
            <a href="https://www.walrus.xyz" className="block text-white/70 hover:text-white">
              Walrus
            </a>
            <a href="https://docs.encrypt.xyz" className="block text-white/70 hover:text-white">
              Encrypt FHE
            </a>
          </div>
          <div className="space-y-2">
            <div className="font-mono text-xs text-white/40">COMMUNITY</div>
            <a href="https://github.com/jacqfos/ikavault-solana" className="block text-white/70 hover:text-white">
              GitHub
            </a>
            <a href="#" className="block text-white/70 hover:text-white">
              Twitter
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
