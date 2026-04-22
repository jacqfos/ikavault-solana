"use client";

import { useEffect, useState } from "react";

import type { Chain } from "./plans";

const STORAGE_KEY = "ikavault.chain";
const VALID: ReadonlyArray<Chain> = ["solana", "sui", "ika"];

function readStored(): Chain | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw && (VALID as ReadonlyArray<string>).includes(raw)
      ? (raw as Chain)
      : null;
  } catch {
    return null;
  }
}

export function useChainPreference(defaultChain: Chain = "solana"): [
  Chain,
  (c: Chain) => void,
] {
  const [chain, setChainState] = useState<Chain>(defaultChain);

  useEffect(() => {
    const stored = readStored();
    if (stored && stored !== chain) setChainState(stored);
  }, []);

  function setChain(c: Chain) {
    setChainState(c);
    try {
      window.localStorage.setItem(STORAGE_KEY, c);
    } catch {
      // ignore quota / private-mode errors
    }
  }

  return [chain, setChain];
}
