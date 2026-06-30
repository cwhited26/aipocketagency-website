// IPC contract shared between the main process and the preload bridge. The renderer never imports
// this directly — it talks through the typed window.paCapture API the preload exposes.

import type { AppConfig } from "../main/config";

/** The snapshot the popover renders. No secrets — only whether a token is set. */
export interface UiState {
  config: AppConfig;
  hasToken: boolean;
  stats: { pending: number; synced: number; total: number };
}

export type PauseMode = "1h" | "tomorrow" | "clear";
export type ListKind = "allow" | "deny";

export const IPC = {
  getState: "pa:get-state",
  setConfig: "pa:set-config",
  setToken: "pa:set-token",
  clearToken: "pa:clear-token",
  pause: "pa:pause",
  addListEntry: "pa:add-list-entry",
  removeListEntry: "pa:remove-list-entry",
  syncNow: "pa:sync-now",
  quit: "pa:quit",
  /** Main → renderer push when state changes (e.g. a new capture arrives while the popover is open). */
  stateChanged: "pa:state-changed",
} as const;
