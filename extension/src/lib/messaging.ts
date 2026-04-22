/// Central chrome.runtime message helper.
///
/// Intercepts VAULT_LOCKED / VAULT_NOT_SETUP errors from the background
/// service worker and invokes a registered handler so the popup can route
/// back to the unlock screen — without each view needing to replicate that logic.

import type { ExtensionMessage, ExtensionResponse } from "./types";

type LockHandler = () => void;

let onVaultLocked: LockHandler | null = null;

export function setVaultLockedHandler(handler: LockHandler | null) {
  onVaultLocked = handler;
}

export async function sendMessage<T = unknown>(
  msg: ExtensionMessage
): Promise<ExtensionResponse<T>> {
  return new Promise((resolve) => {
    if (typeof chrome === "undefined" || !chrome.runtime) {
      resolve({ success: false, error: "chrome.runtime unavailable" });
      return;
    }
    chrome.runtime.sendMessage(msg, (response: ExtensionResponse<T> | undefined) => {
      const resp = response ?? { success: false, error: "No response from background" };
      if (!resp.success && resp.error === "VAULT_LOCKED") {
        onVaultLocked?.();
      }
      resolve(resp);
    });
  });
}
