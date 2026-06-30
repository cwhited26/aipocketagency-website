// AppController — the brain of the menu-bar app. Owns config, the queue, both watchers, and the
// uploader, and exposes the operations the IPC layer and tray call. Keeps no UI; index.ts wires it
// to the tray + popover and re-renders them via the onChange hook.

import { app } from "electron";
import { CaptureQueue } from "./db/queue";
import { ClipboardWatcher } from "./watchers/clipboard";
import { ScreenshotWatcher } from "./watchers/screenshot";
import { Uploader } from "./uploader/sync";
import { loadConfig, saveConfig, type AppConfig } from "./config";
import { queueDbPath, screenshotWatchDirs } from "./paths";
import { getApiToken, setApiToken, clearApiToken, hasApiToken } from "./keychain";
import { pauseForOneHour, pauseUntilTomorrow } from "./capture/pause";
import type { NewCapture } from "../shared/types";
import type { UiState, PauseMode, ListKind } from "../shared/ipc";
import log from "./logger";

export class AppController {
  private config: AppConfig;
  private readonly queue: CaptureQueue;
  private readonly clipboard: ClipboardWatcher;
  private readonly screenshot: ScreenshotWatcher;
  private readonly uploader: Uploader;

  /** Called after any state change so the tray + popover can refresh. */
  onChange: (() => void) | null = null;

  constructor() {
    this.config = loadConfig();
    this.queue = new CaptureQueue(queueDbPath());

    const getConfig = (): AppConfig => this.config;
    const enqueue = (capture: NewCapture): void => this.onCapture(capture);

    this.clipboard = new ClipboardWatcher({ getConfig, enqueue });
    this.screenshot = new ScreenshotWatcher({ getConfig, enqueue, dirs: screenshotWatchDirs() });
    this.uploader = new Uploader({ getConfig, queue: this.queue, getToken: getApiToken });
  }

  /** Boot: apply config (start watchers + login item) and start the uploader. */
  init(): void {
    this.applyConfig();
    this.uploader.start();
    log.info("[controller] initialized");
  }

  private onCapture(capture: NewCapture): void {
    const { inserted } = this.queue.enqueue(capture);
    if (inserted) this.onChange?.();
  }

  /** Reconcile the running watchers + login item with the current config. */
  private applyConfig(): void {
    if (this.config.clipboardWatcherEnabled) this.clipboard.start();
    else this.clipboard.stop();

    if (this.config.screenshotWatcherEnabled) this.screenshot.start();
    else this.screenshot.stop();

    app.setLoginItemSettings({ openAtLogin: this.config.launchAtLogin });
  }

  // ─── State for the UI ──────────────────────────────────────────────────────────

  async getUiState(): Promise<UiState> {
    return {
      config: this.config,
      hasToken: await hasApiToken(),
      stats: this.queue.stats(),
    };
  }

  // ─── Mutations (called from IPC) ───────────────────────────────────────────────

  async setConfig(patch: Partial<AppConfig>): Promise<UiState> {
    this.config = { ...this.config, ...patch };
    saveConfig(this.config);
    this.applyConfig();
    this.onChange?.();
    return this.getUiState();
  }

  async setToken(token: string): Promise<UiState> {
    await setApiToken(token);
    log.info("[controller] API token saved to keychain");
    this.onChange?.();
    return this.getUiState();
  }

  async clearToken(): Promise<UiState> {
    await clearApiToken();
    log.info("[controller] API token cleared");
    this.onChange?.();
    return this.getUiState();
  }

  async setPause(mode: PauseMode): Promise<UiState> {
    const now = new Date();
    const pausedUntil =
      mode === "1h" ? pauseForOneHour(now) : mode === "tomorrow" ? pauseUntilTomorrow(now) : null;
    return this.setConfig({ pausedUntil });
  }

  async updateList(list: ListKind, appName: string, action: "add" | "remove"): Promise<UiState> {
    const name = appName.trim();
    if (!name) return this.getUiState();
    const key = list === "allow" ? "allowlist" : "denylist";
    const current = this.config[key];
    const next =
      action === "add"
        ? Array.from(new Set([...current, name]))
        : current.filter((a) => a.toLowerCase() !== name.toLowerCase());
    return this.setConfig({ [key]: next } as Partial<AppConfig>);
  }

  async syncNow(): Promise<UiState> {
    await this.uploader.runOnce();
    this.onChange?.();
    return this.getUiState();
  }

  shutdown(): void {
    this.clipboard.stop();
    this.screenshot.stop();
    this.uploader.stop();
    this.queue.close();
    log.info("[controller] shut down");
  }
}
