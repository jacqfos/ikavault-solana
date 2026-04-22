import React, { useState, useRef, useEffect } from "react";
import type { AuthState } from "../../lib/types";
import { IkaVaultLogo } from "../App";

interface Props {
  auth: AuthState;
  onPinSet: () => void;
}

const PIN_LENGTH = 6;

export default function PinSetupView({ auth, onPinSet }: Props) {
  const [pin, setPin] = useState<string[]>(Array(PIN_LENGTH).fill(""));
  const [confirm, setConfirm] = useState<string[]>(Array(PIN_LENGTH).fill(""));
  const [step, setStep] = useState<"enter" | "confirm">("enter");
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, [step]);

  function handleDigit(
    index: number,
    value: string,
    arr: string[],
    setArr: (a: string[]) => void
  ) {
    if (!/^\d?$/.test(value)) return;
    const next = [...arr];
    next[index] = value;
    setArr(next);

    if (value && index < PIN_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-advance when last digit filled
    if (value && index === PIN_LENGTH - 1) {
      const full = next.join("");
      if (full.length === PIN_LENGTH) {
        if (step === "enter") {
          setTimeout(() => {
            setStep("confirm");
            setConfirm(Array(PIN_LENGTH).fill(""));
          }, 100);
        }
      }
    }
  }

  function handleKeyDown(
    e: React.KeyboardEvent,
    index: number,
    arr: string[],
    setArr: (a: string[]) => void
  ) {
    if (e.key === "Backspace" && !arr[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      const next = [...arr];
      next[index - 1] = "";
      setArr(next);
    }
  }

  async function handleConfirm() {
    const pinStr = pin.join("");
    const confirmStr = confirm.join("");

    if (pinStr !== confirmStr) {
      setError("PINek nem egyeznek. Próbáld újra.");
      setPin(Array(PIN_LENGTH).fill(""));
      setConfirm(Array(PIN_LENGTH).fill(""));
      setStep("enter");
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
      return;
    }

    setLoading(true);
    setError(undefined);

    try {
      // Get Web3Auth private key — must run in popup context (has `window`)
      const { getPrivateKey } = await import("../../lib/web3auth");
      const privKeyB64 = await getPrivateKey();

      await sendMessage({
        type: "SETUP_PIN",
        payload: {
          publicKey: auth.publicKey,
          pin: pinStr,
          privKeyB64,
        },
      });

      onPinSet();
    } catch (err) {
      setError(err instanceof Error ? err.message : "PIN beállítás sikertelen");
    } finally {
      setLoading(false);
    }
  }

  // Auto-submit confirm step when last digit filled
  useEffect(() => {
    if (step === "confirm" && confirm.every((d) => d !== "")) {
      handleConfirm();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirm]);

  const currentArr = step === "enter" ? pin : confirm;
  const setCurrentArr = step === "enter" ? setPin : setConfirm;

  return (
    <div className="flex flex-col h-screen bg-black">
      <div className="flex-1 flex flex-col items-center justify-center gap-8 px-6">
        <IkaVaultLogo />

        <div className="text-center">
          <h1 className="text-lg font-semibold text-white mb-2">
            {step === "enter" ? "Állítsd be a PIN-kódod" : "Erősítsd meg a PIN-t"}
          </h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            {step === "enter"
              ? "A PIN-t a Google-fiókodhoz kötjük — mindkettő kell a visszafejtéshez."
              : "Add meg még egyszer a PIN-kódot."}
          </p>
        </div>

        {/* PIN dots */}
        <div className="flex gap-3">
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <div key={i} className="relative">
              <input
                ref={(el) => { inputRefs.current[i] = el; }}
                type="password"
                inputMode="numeric"
                maxLength={1}
                value={currentArr[i]}
                onChange={(e) => handleDigit(i, e.target.value, currentArr, setCurrentArr)}
                onKeyDown={(e) => handleKeyDown(e, i, currentArr, setCurrentArr)}
                className="w-12 h-14 text-center text-xl font-bold rounded-xl
                           bg-gray-900 border-2 text-white caret-transparent
                           focus:outline-none focus:border-teal-500
                           border-gray-700 transition-colors"
              />
              {/* Filled indicator */}
              {currentArr[i] && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-3 h-3 rounded-full bg-teal-500" />
                </div>
              )}
            </div>
          ))}
        </div>

        {error && (
          <p className="text-sm text-red-400 text-center">{error}</p>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
            Beállítás folyamatban...
          </div>
        )}

        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-teal-950/30 border border-teal-900/50 text-xs text-teal-300">
          <LockIcon />
          <span>A PIN + Google-fiókod együtt védik a széfedet</span>
        </div>
      </div>

      <div className="pb-4 text-center">
        <p className="text-xs text-gray-700">Powered by Solana · Ika · Walrus</p>
      </div>
    </div>
  );
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

async function sendMessage(msg: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (response: { success: boolean; error?: string }) => {
      if (response?.success) resolve();
      else reject(new Error(response?.error ?? "Unknown error"));
    });
  });
}
