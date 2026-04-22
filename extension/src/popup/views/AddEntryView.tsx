import React, { useState } from "react";
import type { AuthState, VaultEntry } from "../../lib/types";
import { sendMessage } from "../../lib/messaging";
import { humanizeError } from "../../lib/errors";

interface Props {
  auth: AuthState;
  onSave: (entry: VaultEntry) => void;
  onBack: () => void;
}

interface FormState {
  label: string;
  url: string;
  username: string;
  password: string;
  notes: string;
}

export default function AddEntryView({ auth, onSave, onBack }: Props) {
  const [form, setForm] = useState<FormState>({
    label: "",
    url: "",
    username: "",
    password: "",
    notes: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  function update(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    // Auto-fill label from URL if empty
    if (field === "url" && !form.label) {
      try {
        const host = new URL(value.startsWith("http") ? value : `https://${value}`).hostname;
        setForm((f) => ({ ...f, url: value, label: host.replace(/^www\./, "") }));
        return;
      } catch {
        // ignore invalid URL
      }
    }
  }

  async function handleSave() {
    if (!form.label || !form.password) {
      setError("Label and password are required");
      return;
    }

    setSaving(true);
    setError(undefined);

    try {
      const response = await sendMessage<VaultEntry>({
        type: "SAVE_CREDENTIAL",
        payload: {
          publicKey: auth.publicKey,
          label: form.label,
          url: form.url,
          username: form.username,
          password: form.password,
          notes: form.notes || undefined,
        },
      });

      if (response.success && response.data) {
        onSave(response.data);
      } else if (response.error !== "VAULT_LOCKED") {
        // VAULT_LOCKED is handled globally — it routes back to the PIN screen.
        setError(humanizeError(response.error, "Couldn't save this credential — please try again."));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save credential");
    } finally {
      setSaving(false);
    }
  }

  function generatePassword() {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    const arr = new Uint8Array(20);
    crypto.getRandomValues(arr);
    const pwd = Array.from(arr, (b) => chars[b % chars.length]).join("");
    setForm((f) => ({ ...f, password: pwd }));
    setShowPassword(true);
  }

  return (
    <div className="flex flex-col h-screen bg-black">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1a1a1a]">
        <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors">
          <BackIcon />
        </button>
        <h1 className="text-sm font-semibold text-white">Add Credential</h1>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        <Field
          label="Label"
          placeholder="e.g. GitHub Work"
          value={form.label}
          onChange={(v) => update("label", v)}
        />
        <Field
          label="URL"
          placeholder="https://github.com"
          value={form.url}
          onChange={(v) => update("url", v)}
          type="url"
        />
        <Field
          label="Username / Email"
          placeholder="you@example.com"
          value={form.username}
          onChange={(v) => update("username", v)}
          type="email"
        />

        {/* Password field */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 font-medium uppercase tracking-wide">
            Password
          </label>
          <div className="flex items-center gap-2 bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2.5">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Enter or generate password"
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              className="flex-1 bg-transparent text-sm text-white placeholder-gray-600 outline-none font-mono"
            />
            <button
              onClick={() => setShowPassword((v) => !v)}
              className="text-gray-500 hover:text-gray-300"
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
          <button
            onClick={generatePassword}
            className="text-xs text-teal-400 hover:text-teal-300 text-left mt-1"
          >
            Generate strong password
          </button>
        </div>

        <Field
          label="Notes (optional)"
          placeholder="Recovery codes, 2FA backup..."
          value={form.notes}
          onChange={(v) => update("notes", v)}
          multiline
        />

        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}
      </div>

      {/* Save button */}
      <div className="p-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl
                     bg-teal-600 hover:bg-teal-500 active:bg-teal-700
                     text-white font-medium text-sm transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            <SaveIcon />
          )}
          {saving ? "Encrypting & saving..." : "Save to Vault"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  type = "text",
  multiline,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  multiline?: boolean;
}) {
  const inputClass =
    "w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-teal-700 transition-colors";

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-gray-500 font-medium uppercase tracking-wide">
        {label}
      </label>
      {multiline ? (
        <textarea
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className={`${inputClass} resize-none`}
        />
      ) : (
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      )}
    </div>
  );
}

const BackIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="m15 18-6-6 6-6" />
  </svg>
);
const SaveIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
  </svg>
);
const EyeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const EyeOffIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);
