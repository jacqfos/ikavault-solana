import React, { useState } from "react";
import type { AuthState } from "../../lib/types";
import { IkaVaultLogo } from "../App";

interface Props {
  onLogin: (auth: AuthState) => void;
}

export default function LoginView({ onLogin }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  async function handleGoogleLogin() {
    setLoading(true);
    setError(undefined);

    try {
      // Web3Auth must run in popup context (service worker has no `window`)
      const { initWeb3Auth, loginWithGoogle } = await import("../../lib/web3auth");
      await initWeb3Auth();
      const auth = await loginWithGoogle();

      // Tell background to initialize vault on-chain and store key share
      const response = await new Promise<{ success: boolean; error?: string }>(
        (resolve) => {
          chrome.runtime.sendMessage(
            { type: "INIT_VAULT", payload: { publicKey: auth.publicKey } },
            resolve
          );
        }
      );

      if (!response?.success) {
        console.warn("Vault init warning:", response?.error);
        // Non-fatal — vault may already exist, proceed anyway
      }

      onLogin(auth);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-screen bg-black">
      {/* Header */}
      <div className="flex-1 flex flex-col items-center justify-center gap-8 px-6">
        <IkaVaultLogo />

        <div className="text-center">
          <h1 className="text-xl font-semibold text-white mb-2">
            Decentralized Password Manager
          </h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            Your credentials, encrypted with Ika 2PC-MPC and stored on Walrus —
            no central server, no single point of failure.
          </p>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap gap-2 justify-center">
          {["Ika 2PC-MPC", "Walrus Storage", "Solana Native", "Google Login"].map((f) => (
            <span
              key={f}
              className="px-3 py-1 text-xs rounded-full border border-teal-800 text-teal-300 bg-teal-950/30"
            >
              {f}
            </span>
          ))}
        </div>

        {/* Login button */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl
                     bg-white hover:bg-gray-100 active:bg-gray-200
                     text-gray-900 font-medium text-sm
                     transition-colors duration-150
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <GoogleIcon />
          )}
          {loading ? "Signing in..." : "Continue with Google"}
        </button>

        {error && (
          <p className="text-sm text-red-400 text-center">{error}</p>
        )}
      </div>

      {/* Footer */}
      <div className="pb-4 text-center">
        <p className="text-xs text-gray-700">
          Powered by Solana · Ika · Walrus
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}
