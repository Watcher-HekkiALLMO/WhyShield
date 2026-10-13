import {
  DEFAULT_SETTINGS,
  type Settings,
  getSettings,
  normalizeBackendUrl,
  normalizeHost,
  saveSettings,
} from "../shared/settings";

const els = {
  form: document.getElementById("settings-form") as HTMLFormElement,
  urlWarnings: document.getElementById("url-warnings") as HTMLInputElement,
  emailWarnings: document.getElementById("email-warnings") as HTMLInputElement,
  sensitivity: document.getElementById("sensitivity") as HTMLInputElement,
  sensitivityValue: document.getElementById("sensitivity-value") as HTMLSpanElement,
  trustedHosts: document.getElementById("trusted-hosts") as HTMLTextAreaElement,
  trustedHostsError: document.getElementById("trusted-hosts-error") as HTMLParagraphElement,
  backendUrl: document.getElementById("backend-url") as HTMLInputElement,
  backendUrlError: document.getElementById("backend-url-error") as HTMLParagraphElement,
  apiKey: document.getElementById("api-key") as HTMLInputElement,
  resetBtn: document.getElementById("reset-btn") as HTMLButtonElement,
  status: document.getElementById("status") as HTMLSpanElement,
};

const STATUS_VISIBLE_MS = 2000;
let statusTimer: number | null = null;

function showStatus(text: string): void {
  els.status.textContent = text;
  if (statusTimer !== null) clearTimeout(statusTimer);
  statusTimer = window.setTimeout(() => {
    els.status.textContent = "";
    statusTimer = null;
  }, STATUS_VISIBLE_MS);
}

function showError(el: HTMLParagraphElement, message: string | null): void {
  // textContent, never innerHTML: the message can echo back a line the
  // user typed into the trusted-hosts box.
  el.textContent = message ?? "";
  el.hidden = message === null;
}

function renderSensitivity(): void {
  els.sensitivityValue.textContent = Number(els.sensitivity.value).toFixed(2);
}

function fillForm(s: Settings): void {
  els.urlWarnings.checked = s.urlWarnings;
  els.emailWarnings.checked = s.emailWarnings;
  els.sensitivity.value = String(s.sensitivity);
  els.trustedHosts.value = s.trustedHosts.join("\n");
  els.backendUrl.value = s.backendUrl;
  els.apiKey.value = s.apiKey;
  renderSensitivity();
  showError(els.trustedHostsError, null);
  showError(els.backendUrlError, null);
}

type ReadResult =
  | { ok: true; settings: Settings }
  | { ok: false; field: HTMLElement; errorEl: HTMLParagraphElement; message: string };

// Validate every field before writing anything. A save is all-or-nothing
// so the user never ends up with half their changes applied.
function readForm(): ReadResult {
  const backendUrl = normalizeBackendUrl(els.backendUrl.value);
  if (backendUrl === null) {
    return {
      ok: false,
      field: els.backendUrl,
      errorEl: els.backendUrlError,
      message: "That doesn't look like a web address. It should start with http:// or https://.",
    };
  }

  const trustedHosts: string[] = [];
  for (const line of els.trustedHosts.value.split("\n")) {
    if (line.trim() === "") continue;
    const host = normalizeHost(line);
    if (host === null) {
      return {
        ok: false,
        field: els.trustedHosts,
        errorEl: els.trustedHostsError,
        message: `Couldn't read this line as a site address: ${line.trim()}`,
      };
    }
    if (!trustedHosts.includes(host)) trustedHosts.push(host);
  }

  return {
    ok: true,
    settings: {
      backendUrl,
      sensitivity: Number(els.sensitivity.value),
      trustedHosts,
      urlWarnings: els.urlWarnings.checked,
      emailWarnings: els.emailWarnings.checked,
      apiKey: els.apiKey.value.trim(),
    },
  };
}

async function onSave(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  showError(els.trustedHostsError, null);
  showError(els.backendUrlError, null);

  const result = readForm();
  if (!result.ok) {
    showError(result.errorEl, result.message);
    result.field.focus();
    return;
  }

  await saveSettings(result.settings);
  // Re-fill from what we saved so normalization (lowercasing, stripped
  // slashes) is visible immediately.
  fillForm(result.settings);
  showStatus("Saved");
}

async function onReset(): Promise<void> {
  await saveSettings(DEFAULT_SETTINGS);
  fillForm(DEFAULT_SETTINGS);
  showStatus("Reset to defaults");
}

els.form.addEventListener("submit", (e) => void onSave(e));
els.resetBtn.addEventListener("click", () => void onReset());
els.sensitivity.addEventListener("input", renderSensitivity);

void getSettings().then(fillForm);
