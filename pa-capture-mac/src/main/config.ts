// App configuration, persisted as JSON in userData/settings.json. No secrets here — the API token
// lives in the macOS Keychain (keychain.ts). Loading is defensive: a missing/corrupt file or any
// missing field falls back to defaults, so a bad write can never brick the app.

import { readFileSync, writeFileSync } from "node:fs";
import { configPath } from "./paths";
import log from "./logger";

export interface AppConfig {
  clipboardWatcherEnabled: boolean;
  screenshotWatcherEnabled: boolean;
  /** When non-empty, only capture from these apps. */
  allowlist: string[];
  /** Never capture from these apps. */
  denylist: string[];
  /** ISO deadline; capture is paused while this is in the future. null = not paused. */
  pausedUntil: string | null;
  launchAtLogin: boolean;
  /** Base URL of the PA web app the uploader posts to. */
  apiBaseUrl: string;
}

export const DEFAULT_CONFIG: AppConfig = {
  clipboardWatcherEnabled: true,
  screenshotWatcherEnabled: true,
  allowlist: [],
  // Sensible privacy defaults — never capture from password managers.
  denylist: ["1Password", "1Password 7 - Password Manager", "Keychain Access"],
  pausedUntil: null,
  launchAtLogin: false,
  apiBaseUrl: "https://aipocketagent.com",
};

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((v): v is string => typeof v === "string");
}

/** Coerce an untrusted parsed object into a valid AppConfig, filling gaps from defaults. */
export function normalizeConfig(raw: unknown): AppConfig {
  const obj = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    clipboardWatcherEnabled:
      typeof obj.clipboardWatcherEnabled === "boolean"
        ? obj.clipboardWatcherEnabled
        : DEFAULT_CONFIG.clipboardWatcherEnabled,
    screenshotWatcherEnabled:
      typeof obj.screenshotWatcherEnabled === "boolean"
        ? obj.screenshotWatcherEnabled
        : DEFAULT_CONFIG.screenshotWatcherEnabled,
    allowlist: asStringArray(obj.allowlist) ?? DEFAULT_CONFIG.allowlist,
    denylist: asStringArray(obj.denylist) ?? DEFAULT_CONFIG.denylist,
    pausedUntil: typeof obj.pausedUntil === "string" ? obj.pausedUntil : null,
    launchAtLogin:
      typeof obj.launchAtLogin === "boolean" ? obj.launchAtLogin : DEFAULT_CONFIG.launchAtLogin,
    apiBaseUrl:
      typeof obj.apiBaseUrl === "string" && obj.apiBaseUrl.trim()
        ? obj.apiBaseUrl.trim().replace(/\/$/, "")
        : DEFAULT_CONFIG.apiBaseUrl,
  };
}

export function loadConfig(): AppConfig {
  try {
    const raw = readFileSync(configPath(), "utf8");
    return normalizeConfig(JSON.parse(raw));
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      log.warn("[config] could not read settings.json, using defaults", { error: String(err) });
    }
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(config: AppConfig): void {
  writeFileSync(configPath(), JSON.stringify(config, null, 2), "utf8");
}
