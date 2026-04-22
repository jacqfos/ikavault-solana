import React, { useState } from "react";
import type { AuthState, VaultEntry } from "../../lib/types";
import { sendMessage } from "../../lib/messaging";
import { humanizeError } from "../../lib/errors";

interface Props {
  entry: VaultEntry;
  auth: AuthState;
  onBack: () => void;
  onDelete: (index: number) => void;
}

export default function EntryDetailView({ entry, auth, onBack, onDelete }: Props) {
  const [password, setPassword] = useState<string>();
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [copied, setCopied] = useState<"username" | "password" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string>();

  async function revealPassword() {
    setLoadingPassword(true);
    setError(undefined);
    try {
      const response = await sendMessage<{ password: string }>({
        type: "DECRYPT_CREDENTIAL",
        payload: {
          publicKey: auth.publicKey,
          encryptedBlobId: entry.encryptedBlobId,
        },
      });

      if (response.success && response.data) {
        setPassword(response.data.password);
      } else if (response.error !== "VAULT_LOCKED") {
        setError(humanizeError(response.error, "Couldn't decrypt this credential."));
      }
    } finally {
      setLoadingPassword(false);
    }
  }

  async function copyToClipboard(text: string, field: "username" | "password") {
    await navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  }

  async function handleDelete() {
    setDeleting(true);
    setError(undefined);
    try {
      const response = await sendMessage({
        type: "DELETE_CREDENTIAL",
        payload: { publicKey: auth.publicKey, entryIndex: entry.index },
      });
      if (response.success) {
        onDelete(entry.index);
      } else if (response.error !== "VAULT_LOCKED") {
        setError(humanizeError(response.error, "Couldn't delete this credential."));
      }
    } finally {
      setDeleting(false);
    }
  }

  const domain = getDomain(entry.url);

  return (
    <div className="flex flex-col h-screen bg-black">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1a1a1a]">
        <button onClick={onBack} className="text-gray-400 hover:text-white">
          <BackIcon />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-white truncate">{entry.label}</h1>
          <p className="text-xs text-gray-500 truncate">{domain}</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {/* URL */}
        {entry.url && (
          <InfoRow
            label="URL"
            value={entry.url}
            action={
              <a
                href={entry.url}
                target="_blank"
                rel="noreferrer"
                className="text-teal-400 hover:text-teal-300 text-xs"
              >
                Open →
              </a>
            }
          />
        )}

        {/* Username */}
        {entry.username && (
          <InfoRow
            label="Username"
            value={entry.username}
            action={
              <button
                onClick={() => copyToClipboard(entry.username, "username")}
                className="text-xs text-gray-400 hover:text-white"
              >
                {copied === "username" ? (
                  <span className="text-green-400">Copied!</span>
                ) : (
                  <CopyIcon />
                )}
              </button>
            }
          />
        )}

        {/* Password */}
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">
            Password
          </span>
          <div className="flex items-center gap-2 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg px-3 py-2.5">
            <span className="flex-1 text-sm font-mono text-white truncate">
              {password ?? "••••••••••••"}
            </span>
            <div className="flex items-center gap-2">
              {password ? (
                <button
                  onClick={() => copyToClipboard(password, "password")}
                  className="text-gray-400 hover:text-white"
                >
                  {copied === "password" ? (
                    <span className="text-xs text-green-400">Copied!</span>
                  ) : (
                    <CopyIcon />
                  )}
                </button>
              ) : (
                <button
                  onClick={revealPassword}
                  disabled={loadingPassword}
                  className="text-xs text-teal-400 hover:text-teal-300 disabled:opacity-50"
                >
                  {loadingPassword ? "..." : "Reveal"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Metadata */}
        <div className="mt-4 pt-4 border-t border-[#111]">
          <p className="text-xs text-gray-700">
            Added {formatDate(entry.createdAt)}
            {entry.updatedAt !== entry.createdAt && (
              <> · Updated {formatDate(entry.updatedAt)}</>
            )}
          </p>
          <p className="text-xs text-gray-700 mt-1 font-mono truncate">
            Walrus: {entry.encryptedBlobId.slice(0, 16)}...
          </p>
        </div>

        {error && (
          <p className="mt-3 text-xs text-red-400">{error}</p>
        )}

        {/* Delete */}
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="mt-4 text-xs text-red-600 hover:text-red-400"
          >
            Delete credential
          </button>
        ) : (
          <div className="mt-4 p-3 rounded-xl border border-red-900/50 bg-red-950/20 flex flex-col gap-2">
            <p className="text-xs text-red-400">Delete this credential? This cannot be undone.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 py-2 rounded-lg bg-[#111] text-xs text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2 rounded-lg bg-red-900 text-xs text-red-200 hover:bg-red-800 disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value, action }: { label: string; value: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</span>
      <div className="flex items-center gap-2 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg px-3 py-2.5">
        <span className="flex-1 text-sm text-white truncate">{value}</span>
        {action}
      </div>
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

function formatDate(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const BackIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="m15 18-6-6 6-6" />
  </svg>
);
const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);
