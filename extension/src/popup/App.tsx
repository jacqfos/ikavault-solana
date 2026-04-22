import React, { useEffect, useReducer } from "react";
import type { AppState, AppView, AuthState, VaultEntry } from "../lib/types";
import { sendMessage, setVaultLockedHandler } from "../lib/messaging";
import LoginView from "./views/LoginView";
import VaultView from "./views/VaultView";
import AddEntryView from "./views/AddEntryView";
import EntryDetailView from "./views/EntryDetailView";
import PinSetupView from "./views/PinSetupView";
import PinUnlockView from "./views/PinUnlockView";

// ─── State Management ──────────────────────────────────────────────────────────

type Action =
  | { type: "SET_AUTH"; auth: AuthState }
  | { type: "SET_VIEW"; view: AppView }
  | { type: "SET_ENTRIES"; entries: VaultEntry[] }
  | { type: "SET_SELECTED"; entry: VaultEntry | undefined }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "SET_ERROR"; error: string | undefined }
  | { type: "ADD_ENTRY"; entry: VaultEntry }
  | { type: "DELETE_ENTRY"; index: number };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "SET_AUTH":
      return { ...state, auth: action.auth };
    case "SET_VIEW":
      return { ...state, currentView: action.view };
    case "SET_ENTRIES":
      return { ...state, entries: action.entries };
    case "SET_SELECTED":
      return { ...state, selectedEntry: action.entry };
    case "SET_LOADING":
      return { ...state, isLoading: action.loading };
    case "SET_ERROR":
      return { ...state, error: action.error };
    case "ADD_ENTRY":
      return { ...state, entries: [...state.entries, action.entry] };
    case "DELETE_ENTRY":
      return {
        ...state,
        entries: state.entries.map((e) =>
          e.index === action.index ? { ...e, isActive: false } : e
        ),
      };
    default:
      return state;
  }
}

const initialState: AppState = {
  auth: { status: "unauthenticated" },
  currentView: "login",
  entries: [],
  isLoading: true,
  error: undefined,
};

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Check existing auth on mount
  useEffect(() => {
    checkAuth();
  }, []);

  // Route back to PIN unlock whenever the background reports VAULT_LOCKED
  useEffect(() => {
    setVaultLockedHandler(() => {
      dispatch({ type: "SET_VIEW", view: "pin_unlock" });
      dispatch({ type: "SET_SELECTED", entry: undefined });
    });
    return () => setVaultLockedHandler(null);
  }, []);

  async function checkAuth() {
    dispatch({ type: "SET_LOADING", loading: true });
    try {
      const stored = await getStoredAuth();
      if (stored?.status === "authenticated" && stored.publicKey) {
        dispatch({ type: "SET_AUTH", auth: stored });

        // Check if PIN has been set up
        const hasPinResp = await sendMessage<{ hasPin: boolean }>({
          type: "HAS_PIN",
          payload: { publicKey: stored.publicKey },
        });

        if (hasPinResp?.data?.hasPin) {
          // PIN exists — vault is locked after service worker restart
          dispatch({ type: "SET_VIEW", view: "pin_unlock" });
        } else {
          // No PIN yet — shouldn't happen in normal flow, send to setup
          dispatch({ type: "SET_VIEW", view: "pin_setup" });
        }
      } else {
        dispatch({ type: "SET_VIEW", view: "login" });
      }
    } catch (err) {
      console.error("Auth check failed:", err);
      dispatch({ type: "SET_VIEW", view: "login" });
    } finally {
      dispatch({ type: "SET_LOADING", loading: false });
    }
  }

  /** Called by LoginView after Google OAuth succeeds. Routes to PIN setup. */
  async function handleLogin(auth: AuthState) {
    dispatch({ type: "SET_AUTH", auth });
    await storeAuth(auth);

    // First time: check if PIN already set (e.g. re-login on same device)
    const hasPinResp = await sendMessage<{ hasPin: boolean }>({
      type: "HAS_PIN",
      payload: { publicKey: auth.publicKey },
    });

    if (hasPinResp?.data?.hasPin) {
      dispatch({ type: "SET_VIEW", view: "pin_unlock" });
    } else {
      dispatch({ type: "SET_VIEW", view: "pin_setup" });
    }
  }

  /** Called by PinSetupView after PIN is saved. */
  async function handlePinSet() {
    dispatch({ type: "SET_LOADING", loading: true });
    try {
      await loadEntries(state.auth.publicKey!);
      dispatch({ type: "SET_VIEW", view: "vault" });
    } finally {
      dispatch({ type: "SET_LOADING", loading: false });
    }
  }

  /** Called by PinUnlockView after correct PIN entered. */
  async function handleUnlocked() {
    dispatch({ type: "SET_LOADING", loading: true });
    try {
      await loadEntries(state.auth.publicKey!);
      dispatch({ type: "SET_VIEW", view: "vault" });
    } finally {
      dispatch({ type: "SET_LOADING", loading: false });
    }
  }

  async function loadEntries(publicKey: string) {
    const response = await sendMessage<{ entries: VaultEntry[] }>({
      type: "GET_USER_PROFILE",
      payload: { publicKey },
    });

    if (response?.success && response.data) {
      dispatch({ type: "SET_ENTRIES", entries: response.data.entries });
    }
  }

  async function handleAddEntry(entry: VaultEntry) {
    dispatch({ type: "ADD_ENTRY", entry });
    dispatch({ type: "SET_VIEW", view: "vault" });
  }

  function handleSelectEntry(entry: VaultEntry) {
    dispatch({ type: "SET_SELECTED", entry });
    dispatch({ type: "SET_VIEW", view: "detail" });
  }

  function handleDeleteEntry(index: number) {
    dispatch({ type: "DELETE_ENTRY", index });
    dispatch({ type: "SET_VIEW", view: "vault" });
  }

  async function handleLogout() {
    await sendMessage({ type: "LOGOUT" });
    dispatch({ type: "SET_AUTH", auth: { status: "unauthenticated" } });
    dispatch({ type: "SET_ENTRIES", entries: [] });
    dispatch({ type: "SET_VIEW", view: "login" });
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  if (state.isLoading) {
    return <LoadingScreen />;
  }

  switch (state.currentView) {
    case "login":
      return <LoginView onLogin={handleLogin} />;
    case "pin_setup":
      return <PinSetupView auth={state.auth} onPinSet={handlePinSet} />;
    case "pin_unlock":
      return (
        <PinUnlockView
          auth={state.auth}
          onUnlocked={handleUnlocked}
          onLogout={handleLogout}
        />
      );
    case "vault":
      return (
        <VaultView
          auth={state.auth}
          entries={state.entries.filter((e) => e.isActive)}
          onAddNew={() => dispatch({ type: "SET_VIEW", view: "add" })}
          onSelect={handleSelectEntry}
          onLogout={handleLogout}
        />
      );
    case "add":
      return (
        <AddEntryView
          auth={state.auth}
          onSave={handleAddEntry}
          onBack={() => dispatch({ type: "SET_VIEW", view: "vault" })}
        />
      );
    case "detail":
      return (
        <EntryDetailView
          entry={state.selectedEntry!}
          auth={state.auth}
          onBack={() => dispatch({ type: "SET_VIEW", view: "vault" })}
          onDelete={handleDeleteEntry}
        />
      );
    default:
      return <LoginView onLogin={handleLogin} />;
  }
}

// ─── Loading Screen ────────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-black gap-3">
      <IkaVaultLogo />
      <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export function IkaVaultLogo({ size = "md" }: { size?: "sm" | "md" }) {
  const iconPx = size === "sm" ? 20 : 32;
  const textCls = size === "sm" ? "text-sm" : "text-lg";
  return (
    <div className="flex items-center gap-2">
      <img
        src={chrome.runtime?.getURL?.("icons/icon48.png") ?? "/icons/icon48.png"}
        alt="IkaVault"
        width={iconPx}
        height={iconPx}
        className="rounded-md"
      />
      <span className={`text-white font-semibold tracking-tight ${textCls}`}>
        Ika<span className="text-teal-400">Vault</span>
      </span>
    </div>
  );
}

// ─── Chrome Extension Helpers ──────────────────────────────────────────────────

async function getStoredAuth(): Promise<AuthState | null> {
  return new Promise((resolve) => {
    if (typeof chrome === "undefined" || !chrome.storage) {
      resolve(null);
      return;
    }
    chrome.storage.local.get("authState", (result) => {
      resolve(result.authState ?? null);
    });
  });
}

async function storeAuth(auth: AuthState): Promise<void> {
  return new Promise((resolve) => {
    if (typeof chrome === "undefined" || !chrome.storage) {
      resolve();
      return;
    }
    chrome.storage.local.set({ authState: auth }, resolve);
  });
}

