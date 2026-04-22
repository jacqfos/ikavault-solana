import React, { useState } from "react";
import type { AuthState, VaultEntry } from "../../lib/types";
import { IkaVaultLogo } from "../App";

interface Props {
  auth: AuthState;
  entries: VaultEntry[];
  onAddNew: () => void;
  onSelect: (entry: VaultEntry) => void;
  onLogout: () => void;
}

export default function VaultView({ auth, entries, onAddNew, onSelect, onLogout }: Props) {
  const [search, setSearch] = useState("");

  const filtered = entries.filter(
    (e) =>
      e.label.toLowerCase().includes(search.toLowerCase()) ||
      e.url.toLowerCase().includes(search.toLowerCase()) ||
      e.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-screen bg-black">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a]">
        <IkaVaultLogo size="sm" />
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            {auth.publicKey?.slice(0, 4)}...{auth.publicKey?.slice(-4)}
          </span>
          {auth.profilePicture && (
            <img
              src={auth.profilePicture}
              alt="avatar"
              className="w-6 h-6 rounded-full"
            />
          )}
          <button
            onClick={onLogout}
            title="Sign out"
            className="text-gray-600 hover:text-gray-300 transition-colors ml-1"
          >
            <LogoutIcon />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-2">
        <div className="flex items-center gap-2 bg-[#111] border border-[#222] rounded-lg px-3 py-2">
          <SearchIcon />
          <input
            type="text"
            placeholder="Search credentials..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm text-white placeholder-gray-600 outline-none"
          />
        </div>
      </div>

      {/* Entry list */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {filtered.length === 0 ? (
          <EmptyState hasEntries={entries.length > 0} onAddNew={onAddNew} />
        ) : (
          <div className="flex flex-col gap-2 mt-2">
            {filtered.map((entry) => (
              <EntryCard key={entry.index} entry={entry} onClick={() => onSelect(entry)} />
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <div className="p-4">
        <button
          onClick={onAddNew}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl
                     bg-teal-600 hover:bg-teal-500 active:bg-teal-700
                     text-white font-medium text-sm transition-colors"
        >
          <PlusIcon />
          Add Credential
        </button>
      </div>
    </div>
  );
}

function EntryCard({ entry, onClick }: { entry: VaultEntry; onClick: () => void }) {
  const domain = getDomain(entry.url);
  const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl
                 bg-[#0a0a0a] hover:bg-[#111] active:bg-[#1a1a1a]
                 border border-[#1a1a1a] hover:border-[#333]
                 transition-colors text-left"
    >
      <div className="w-9 h-9 rounded-lg bg-[#111] border border-[#222] flex items-center justify-center flex-shrink-0 overflow-hidden">
        <img
          src={favicon}
          alt=""
          className="w-5 h-5"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium truncate">{entry.label}</p>
        <p className="text-xs text-gray-500 truncate">{entry.username || domain}</p>
      </div>
      <ChevronIcon />
    </button>
  );
}

function EmptyState({ hasEntries, onAddNew }: { hasEntries: boolean; onAddNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#0a0a0a] border border-[#1a1a1a] flex items-center justify-center">
        <LockIcon />
      </div>
      <div>
        <p className="text-white font-medium mb-1">
          {hasEntries ? "No results" : "No credentials yet"}
        </p>
        <p className="text-xs text-gray-600">
          {hasEntries
            ? "Try a different search"
            : "Add your first credential to get started"}
        </p>
      </div>
      {!hasEntries && (
        <button
          onClick={onAddNew}
          className="text-sm text-teal-400 hover:text-teal-300"
        >
          Add credential →
        </button>
      )}
    </div>
  );
}

function getDomain(url: string): string {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
  } catch {
    return url;
  }
}

const LogoutIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);
const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2">
    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
  </svg>
);
const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const ChevronIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="2">
    <path d="m9 18 6-6-6-6" />
  </svg>
);
const LockIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="1.5">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
