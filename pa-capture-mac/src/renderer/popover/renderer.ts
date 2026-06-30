// Popover renderer. Talks to the main process only through window.paCapture (exposed by preload).
// Every action returns a fresh state; we also listen for pushed state so the queue count stays live.

// This file is a module (so `declare global` below is allowed and tree-shaken cleanly).
export {};

interface RConfig {
  clipboardWatcherEnabled: boolean;
  screenshotWatcherEnabled: boolean;
  allowlist: string[];
  denylist: string[];
  pausedUntil: string | null;
  launchAtLogin: boolean;
  apiBaseUrl: string;
}

interface RState {
  config: RConfig;
  hasToken: boolean;
  stats: { pending: number; synced: number; total: number };
}

interface PaCaptureApi {
  getState(): Promise<RState>;
  setConfig(patch: Partial<RConfig>): Promise<RState>;
  setToken(token: string): Promise<RState>;
  clearToken(): Promise<RState>;
  pause(mode: "1h" | "tomorrow" | "clear"): Promise<RState>;
  addListEntry(list: "allow" | "deny", name: string): Promise<RState>;
  removeListEntry(list: "allow" | "deny", name: string): Promise<RState>;
  syncNow(): Promise<RState>;
  quit(): Promise<void>;
  onState(callback: (state: RState) => void): void;
}

declare global {
  interface Window {
    paCapture: PaCaptureApi;
  }
}

const api = window.paCapture;

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing element #${id}`);
  return node as T;
}

function isPaused(pausedUntil: string | null): boolean {
  if (!pausedUntil) return false;
  const t = Date.parse(pausedUntil);
  return !Number.isNaN(t) && t > Date.now();
}

function renderChips(container: HTMLElement, list: "allow" | "deny", names: string[]): void {
  container.replaceChildren();
  for (const name of names) {
    const chip = document.createElement("span");
    chip.className = "chip";
    const label = document.createElement("span");
    label.textContent = name;
    const remove = document.createElement("button");
    remove.textContent = "✕";
    remove.title = `Remove ${name}`;
    remove.addEventListener("click", () => {
      void api.removeListEntry(list, name).then(render);
    });
    chip.append(label, remove);
    container.append(chip);
  }
}

function render(state: RState): void {
  el<HTMLDivElement>("status").textContent = isPaused(state.config.pausedUntil)
    ? "Paused"
    : "Capturing";

  // Token
  el("token-connected").classList.toggle("hidden", !state.hasToken);
  el("token-disconnected").classList.toggle("hidden", state.hasToken);

  // Watchers
  el<HTMLInputElement>("toggle-clipboard").checked = state.config.clipboardWatcherEnabled;
  el<HTMLInputElement>("toggle-screenshot").checked = state.config.screenshotWatcherEnabled;
  el<HTMLInputElement>("toggle-login").checked = state.config.launchAtLogin;

  // Lists
  renderChips(el("allow-chips"), "allow", state.config.allowlist);
  renderChips(el("deny-chips"), "deny", state.config.denylist);

  // Footer
  el<HTMLSpanElement>("queue-stats").textContent = `${state.stats.pending} queued · ${state.stats.synced} synced`;
}

function bindStaticHandlers(): void {
  el<HTMLButtonElement>("token-save").addEventListener("click", () => {
    const input = el<HTMLInputElement>("token-input");
    const token = input.value.trim();
    if (!token) return;
    void api.setToken(token).then((state) => {
      input.value = "";
      render(state);
    });
  });

  el<HTMLButtonElement>("token-clear").addEventListener("click", () => {
    void api.clearToken().then(render);
  });

  el<HTMLInputElement>("toggle-clipboard").addEventListener("change", (e) => {
    void api.setConfig({ clipboardWatcherEnabled: (e.target as HTMLInputElement).checked }).then(render);
  });
  el<HTMLInputElement>("toggle-screenshot").addEventListener("change", (e) => {
    void api.setConfig({ screenshotWatcherEnabled: (e.target as HTMLInputElement).checked }).then(render);
  });
  el<HTMLInputElement>("toggle-login").addEventListener("change", (e) => {
    void api.setConfig({ launchAtLogin: (e.target as HTMLInputElement).checked }).then(render);
  });

  el<HTMLButtonElement>("pause-1h").addEventListener("click", () => {
    void api.pause("1h").then(render);
  });
  el<HTMLButtonElement>("pause-tomorrow").addEventListener("click", () => {
    void api.pause("tomorrow").then(render);
  });
  el<HTMLButtonElement>("pause-resume").addEventListener("click", () => {
    void api.pause("clear").then(render);
  });

  const addFrom = (inputId: string, list: "allow" | "deny"): void => {
    const input = el<HTMLInputElement>(inputId);
    const name = input.value.trim();
    if (!name) return;
    void api.addListEntry(list, name).then((state) => {
      input.value = "";
      render(state);
    });
  };
  el<HTMLButtonElement>("allow-add").addEventListener("click", () => addFrom("allow-input", "allow"));
  el<HTMLButtonElement>("deny-add").addEventListener("click", () => addFrom("deny-input", "deny"));

  el<HTMLButtonElement>("sync-now").addEventListener("click", () => {
    void api.syncNow().then(render);
  });
  el<HTMLButtonElement>("quit").addEventListener("click", () => {
    void api.quit();
  });

  // Live updates pushed from the main process (e.g. a new capture while the popover is open).
  api.onState(render);
}

bindStaticHandlers();
void api.getState().then(render);
