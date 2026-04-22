import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "IkaVault — Your passwords. Split between you and no one.",
  description:
    "Decentralized browser password manager on Solana. 2PC-MPC split-key custody, Walrus blob storage, FHE on-chain search. No master password — just you, your Google login, and math.",
  metadataBase: new URL("https://ikavault.walrus.site"),
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    title: "IkaVault",
    description:
      "Split-key password manager on Solana. No server can decrypt your vault — not even us.",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "IkaVault",
    description:
      "Split-key password manager on Solana. No server can decrypt your vault — not even us.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-ink-950 text-white antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
