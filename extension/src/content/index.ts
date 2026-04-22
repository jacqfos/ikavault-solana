/// IkaVault content script — autofill detection and injection.
///
/// Runs on every page. Detects login forms and communicates
/// with the background worker to fetch/autofill credentials.

interface PasswordField {
  input: HTMLInputElement;
  usernameInput?: HTMLInputElement;
  form: HTMLFormElement | null;
}

// Detect password fields on page load and on DOM mutations
const observer = new MutationObserver(() => detectAndInject());
observer.observe(document.body, { childList: true, subtree: true });
detectAndInject();

// Listen for autofill commands from popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "AUTOFILL") {
    const { username, password } = message.payload as {
      username: string;
      password: string;
    };
    autofill(username, password);
    sendResponse({ success: true });
    return false;
  }
});

// ─── Detection ────────────────────────────────────────────────────────────────

function detectAndInject() {
  const fields = findPasswordFields();
  if (fields.length === 0) return;

  for (const field of fields) {
    injectAutofillButton(field);
  }

  // Notify background about detected login form
  chrome.runtime.sendMessage({
    type: "GET_CREDENTIALS_FOR_URL",
    payload: {
      publicKey: getStoredPublicKey(),
      url: window.location.href,
    },
  });
}

function findPasswordFields(): PasswordField[] {
  const passwordInputs = Array.from(
    document.querySelectorAll<HTMLInputElement>(
      'input[type="password"]:not([data-ikavault-injected])'
    )
  );

  return passwordInputs.map((input) => {
    const form = input.closest("form");
    const usernameInput = findUsernameInput(input, form);
    return { input, usernameInput: usernameInput ?? undefined, form };
  });
}

function findUsernameInput(
  passwordInput: HTMLInputElement,
  form: HTMLFormElement | null
): HTMLInputElement | null {
  // Look for email/username input before the password field
  const searchRoot = form ?? document;
  const candidates = Array.from(
    searchRoot.querySelectorAll<HTMLInputElement>(
      'input[type="email"], input[type="text"], input[autocomplete="username"]'
    )
  );

  // Return the last candidate before the password field in DOM order
  const allInputs = Array.from(document.querySelectorAll<HTMLInputElement>("input"));
  const passwordIndex = allInputs.indexOf(passwordInput);
  const before = candidates.filter(
    (c) => allInputs.indexOf(c) < passwordIndex
  );

  return before[before.length - 1] ?? null;
}

// ─── Injection ────────────────────────────────────────────────────────────────

function injectAutofillButton(field: PasswordField) {
  field.input.setAttribute("data-ikavault-injected", "true");

  const wrapper = field.input.parentElement;
  if (!wrapper) return;

  // Ensure wrapper is positioned
  const style = getComputedStyle(wrapper);
  if (style.position === "static") {
    wrapper.style.position = "relative";
  }

  const button = document.createElement("button");
  button.type = "button";
  button.title = "Autofill with IkaVault";
  button.style.cssText = `
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    width: 20px;
    height: 20px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    z-index: 9999;
    opacity: 0.6;
    transition: opacity 0.15s;
  `;
  button.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9945FF" stroke-width="2">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  `;
  button.addEventListener("mouseenter", () => (button.style.opacity = "1"));
  button.addEventListener("mouseleave", () => (button.style.opacity = "0.6"));
  button.addEventListener("click", () => triggerAutofill(field));

  wrapper.appendChild(button);
}

// ─── Autofill ─────────────────────────────────────────────────────────────────

async function triggerAutofill(field: PasswordField) {
  const publicKey = getStoredPublicKey();
  if (!publicKey) {
    // Open extension popup
    chrome.runtime.sendMessage({ type: "OPEN_POPUP" });
    return;
  }

  const response = await chrome.runtime.sendMessage({
    type: "GET_CREDENTIALS_FOR_URL",
    payload: { publicKey, url: window.location.href },
  });

  if (!response?.success || !response.data?.length) return;

  const entries = response.data as Array<{ username: string; encryptedBlobId: string }>;

  // If single match, auto-select; otherwise show picker (TODO)
  if (entries.length === 1) {
    const { username, encryptedBlobId } = entries[0];

    const decryptResponse = await chrome.runtime.sendMessage({
      type: "DECRYPT_CREDENTIAL",
      payload: { publicKey, encryptedBlobId },
    });

    if (decryptResponse?.success) {
      autofill(username, decryptResponse.data.password);
    }
  }
}

function autofill(username: string, password: string) {
  const passwordInput = document.querySelector<HTMLInputElement>('input[type="password"]');
  if (!passwordInput) return;

  // Fill password
  fillInput(passwordInput, password);

  // Fill username if found
  const field = findPasswordFields().find((f) => f.input === passwordInput);
  if (field?.usernameInput) {
    fillInput(field.usernameInput, username);
  }
}

function fillInput(input: HTMLInputElement, value: string) {
  // Trigger React/Vue synthetic events
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value"
  )?.set;

  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(input, value);
  } else {
    input.value = value;
  }

  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStoredPublicKey(): string | null {
  // Chrome storage is async — we cache in sessionStorage for content scripts
  return sessionStorage.getItem("ikavault_pubkey");
}

// Listen for auth updates from background
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "AUTH_UPDATE" && message.payload?.publicKey) {
    sessionStorage.setItem("ikavault_pubkey", message.payload.publicKey);
  }
});
