import { Nav } from "@/components/sections/Nav";
import { Footer } from "@/components/sections/Footer";

export default function DocsPage() {
  return (
    <main className="relative min-h-screen pt-24">
      <Nav />
      <div className="absolute inset-x-0 top-0 -z-10 h-[480px] bg-[radial-gradient(ellipse_at_top,rgba(124,255,203,0.06),transparent_60%)]" />

      <article className="mx-auto max-w-3xl px-6 py-16">
        <div className="mb-10">
          <div className="font-mono text-xs text-mint">// DOCS</div>
          <h1 className="mt-2 font-display text-4xl font-semibold md:text-5xl">
            How IkaVault actually works.
          </h1>
          <p className="mt-4 text-white/60">
            The short, honest version of the architecture. If you&apos;re
            reviewing for the hackathon — this is the right page.
          </p>
        </div>

        <div className="prose prose-invert max-w-none space-y-12">
          <Section
            title="Identity"
            color="text-mint"
            body={
              <>
                <p>
                  We don&apos;t store accounts. Sign-in goes through{" "}
                  <b>Web3Auth</b>, which takes a Google OAuth token and returns
                  an ed25519 Solana keypair derived from your Google identity.
                  No password, no seed phrase, no &quot;forgot password&quot;
                  flow to phish.
                </p>
                <p>
                  This Solana key is only used for Solana transactions (vault
                  pointer updates). It is <i>not</i> the encryption key.
                </p>
              </>
            }
          />
          <Section
            title="Encryption key — Ika 2PC-MPC"
            color="text-violet"
            body={
              <>
                <p>
                  The real secret is a <b>distributed EdDSA key</b> created
                  with the Ika network. Two shares:
                </p>
                <ul>
                  <li>
                    <b>User share</b> — lives on your device, sealed behind a
                    PIN.
                  </li>
                  <li>
                    <b>Network share</b> — held across Ika validators, never
                    reconstructed.
                  </li>
                </ul>
                <p>
                  To encrypt or sign, the two sides run a multiparty computation
                  and produce a result <i>without ever combining the shares</i>.
                  If either side is compromised, the attacker has half a key —
                  useless.
                </p>
              </>
            }
          />
          <Section
            title="Storage — Walrus"
            color="text-pink"
            body={
              <>
                <p>
                  Vault ciphertext is uploaded to <b>Walrus</b> — a
                  content-addressed decentralized storage network. We keep only
                  a <i>blob pointer</i> on Solana: a 32-byte ID plus metadata
                  (URL pattern, created_at).
                </p>
                <p>
                  On read, the extension: fetches the pointer from the Solana
                  PDA → pulls the blob from Walrus → 2PC-MPC decrypts on
                  device → autofills the form.
                </p>
              </>
            }
          />
          <Section
            title="Search — Encrypt FHE (stretch)"
            color="text-mint"
            body={
              <>
                <p>
                  For fuzzy search over a large vault, we can&apos;t decrypt
                  every blob. We use <b>Encrypt FHE</b> on Solana to run a
                  match over ciphertext: the query stays encrypted, the index
                  stays encrypted, the result is encrypted — and only the
                  matching blob ID is revealed.
                </p>
                <p>
                  Status: pre-alpha / devnet Q2 2026. Enabled for Pro users as
                  it matures.
                </p>
              </>
            }
          />
          <Section
            title="On-chain program"
            color="text-violet"
            body={
              <>
                <p>
                  The Anchor program is small by design. It holds only
                  pointers and policy — never ciphertext, never keys.
                </p>
                <ul>
                  <li>
                    <b>init_vault</b> — creates a user profile PDA with dWallet
                    reference and an empty vault pointer
                  </li>
                  <li>
                    <b>add_entry / update_entry / delete_entry</b> — mutate the
                    vault&apos;s Walrus blob pointer
                  </li>
                  <li>
                    <b>share_entry</b> — write an ACL record so a recipient can
                    fetch the re-encrypted blob
                  </li>
                </ul>
              </>
            }
          />
          <Section
            title="Pro Pass"
            color="text-pink"
            body={
              <>
                <p>
                  Pro features are unlocked by a <b>stablecoin payment</b> to
                  the IkaVault treasury — <b>USDC or USDT</b> on Solana (SPL
                  transfer) or Sui (PTB transfer of the coin type). The user
                  picks Annual or Lifetime at checkout; pricing is flat USD, so
                  the amount doesn&apos;t drift with SOL/SUI market moves.
                </p>
                <p>
                  The extension verifies the tx from-chain (treasury inflow from
                  the user&apos;s wallet, filtered by mint/coin type) and
                  enforces the Annual expiry locally off the tx timestamp. No
                  license server, no backend, no custom on-chain program.
                </p>
              </>
            }
          />
          <Section
            title="What we don't have"
            color="text-white/60"
            body={
              <>
                <ul>
                  <li>
                    A backend. Reads and writes go straight to Solana RPC,
                    Walrus, and Ika gRPC.
                  </li>
                  <li>
                    Your Google login. Web3Auth holds that; we see an opaque
                    pubkey.
                  </li>
                  <li>
                    Your decryption key. Ever. Full stop.
                  </li>
                </ul>
              </>
            }
          />
        </div>
      </article>

      <Footer />
    </main>
  );
}

function Section({
  title,
  body,
  color,
}: {
  title: string;
  body: React.ReactNode;
  color: string;
}) {
  return (
    <section className="gradient-border glass rounded-2xl p-8">
      <h2 className={`mb-4 font-display text-2xl font-semibold ${color}`}>
        {title}
      </h2>
      <div className="space-y-3 text-white/75 [&_b]:text-white [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_p]:leading-relaxed">
        {body}
      </div>
    </section>
  );
}
