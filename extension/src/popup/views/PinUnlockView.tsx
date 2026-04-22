import React, { useState, useRef, useEffect } from "react";
import type { AuthState } from "../../lib/types";
import { IkaVaultLogo } from "../App";

interface Props {
  auth: AuthState;
  onUnlocked: () => void;
  onLogout: () => void;
}

const PIN_LENGTH = 6;

export default function PinUnlockView({ auth, onUnlocked, onLogout }: Props) {
  const [pin, setPin] = useState<string[]>(Array(PIN_LENGTH).fill(""));
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  function handleDigit(index: number, value: string) {
    if (!/^\d?$/.test(value)) return;
    const next = [...pin];
    next[index] = value;
    setPin(next);
    setError(undefined);

    if (value && index < PIN_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key === "Backspace" && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      const next = [...pin];
      next[index - 1] = "";
      setPin(next);
    }
  }

  async function handleUnlock() {
    const pinStr = pin.join("");
    if (pinStr.length < PIN_LENGTH) return;

    setLoading(true);
    setError(undefined);

    try {
      const response = await sendMessage<{ success: boolean; error?: string }>({
        type: "UNLOCK_VAULT",
        payload: { publicKey: auth.publicKey, pin: pinStr },
      });

      if (response?.success) {
        onUnlocked();
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        setPin(Array(PIN_LENGTH).fill(""));
        setTimeout(() => inputRefs.current[0]?.focus(), 50);

        if (newAttempts >= 5) {
          setError(`Helytelen PIN (${newAttempts} próbálkozás). Jelentkezz ki és lépj be újra Google-lal.`);
        } else {
          setError(`Helytelen PIN. ${5 - newAttempts} próbálkozás maradt.`);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba történt");
    } finally {
      setLoading(false);
    }
  }

  // Auto-submit when all digits filled
  useEffect(() => {
    if (pin.every((d) => d !== "")) {
      handleUnlock();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  const tooManyAttempts = attempts >= 5;

  return (
    <div className="flex flex-col h-screen bg-black">
      <div className="flex-1 flex flex-col items-center justify-center gap-8 px-6">
        <IkaVaultLogo />

        <div className="text-center">
          <h1 className="text-lg font-semibold text-white mb-2">Vault zárolva</h1>
          <p className="text-sm text-gray-500">
            {auth.displayName
              ? `Üdv, ${auth.displayName}! Add meg a PIN-kódod.`
              : "Add meg a PIN-kódodat a folytatáshoz."}
          </p>
        </div>

        {/* Profile picture */}
        {auth.profilePicture && (
          <img
            src={auth.profilePicture}
            alt="profil"
            className="w-14 h-14 rounded-full border-2 border-teal-800"
          />
        )}

        {/* PIN input */}
        <div className="flex gap-3">
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <div key={i} className="relative">
              <input
                ref={(el) => { inputRefs.current[i] = el; }}
                type="password"
                inputMode="numeric"
                maxLength={1}
                value={pin[i]}
                disabled={loading || tooManyAttempts}
                onChange={(e) => handleDigit(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, i)}
                className="w-12 h-14 text-center text-xl font-bold rounded-xl
                           bg-gray-900 border-2 text-white caret-transparent
                           focus:outline-none focus:border-teal-500
                           border-gray-700 transition-colors
                           disabled:opacity-40"
              />
              {pin[i] && !loading && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-3 h-3 rounded-full bg-teal-500" />
                </div>
              )}
            </div>
          ))}
        </div>

        {loading && (
          <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
        )}

        {error && (
          <p className="text-sm text-red-400 text-center px-4">{error}</p>
        )}

        <button
          onClick={onLogout}
          className="text-xs text-gray-600 hover:text-gray-400 underline transition-colors"
        >
          Kijelentkezés és új Google-bejelentkezés
        </button>
      </div>

      <div className="pb-4 text-center">
        <p className="text-xs text-gray-700">Powered by Solana · Ika · Walrus</p>
      </div>
    </div>
  );
}

function sendMessage<T>(msg: unknown): Promise<T> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, resolve);
  });
}
