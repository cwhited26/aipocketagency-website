// Screenshot watcher — watches the Screenshots + Desktop folders for new image files (PNG/JPG that
// appeared in the last 60s) and enqueues them. Source app is the pseudo-app "Screenshot" so users can
// allow/deny screenshots by name like any other source. Dedup is the queue's job (UNIQUE hash).

import { watch, statSync, readFileSync, existsSync, type FSWatcher } from "node:fs";
import path from "node:path";
import type { AppConfig } from "../config";
import type { NewCapture } from "../../shared/types";
import { isCapturePaused } from "../capture/pause";
import { shouldCaptureFromApp } from "../capture/filter";
import { mimeFromFilename, isScreenshotImage } from "./mime";
import { SCREENSHOT_MAX_AGE_MS, MAX_INLINE_CAPTURE_BYTES } from "../../shared/constants";
import log from "../logger";

/** The pseudo source-app name screenshots are tagged with (so allow/deny rules can target them). */
export const SCREENSHOT_SOURCE_APP = "Screenshot";

/** Delay before reading a newly-seen file, letting the OS finish writing it. */
const SETTLE_MS = 400;

export interface ScreenshotWatcherDeps {
  getConfig: () => AppConfig;
  enqueue: (capture: NewCapture) => void;
  dirs: string[];
}

export class ScreenshotWatcher {
  private watchers: FSWatcher[] = [];
  private readonly processed = new Set<string>();

  constructor(private readonly deps: ScreenshotWatcherDeps) {}

  start(): void {
    if (this.watchers.length > 0) return;
    for (const dir of this.deps.dirs) {
      if (!existsSync(dir)) {
        log.info("[screenshot] folder not present, skipping", { dir });
        continue;
      }
      try {
        const watcher = watch(dir, (_event, filename) => {
          if (filename) this.onEvent(dir, filename.toString());
        });
        watcher.on("error", (err) => log.error("[screenshot] watch error", { dir, error: String(err) }));
        this.watchers.push(watcher);
        log.info("[screenshot] watching", { dir });
      } catch (err) {
        log.error("[screenshot] could not watch folder", { dir, error: String(err) });
      }
    }
  }

  stop(): void {
    for (const watcher of this.watchers) watcher.close();
    this.watchers = [];
    log.info("[screenshot] watcher stopped");
  }

  isRunning(): boolean {
    return this.watchers.length > 0;
  }

  private onEvent(dir: string, filename: string): void {
    if (!isScreenshotImage(filename)) return;
    const full = path.join(dir, filename);
    setTimeout(() => {
      void this.handle(full);
    }, SETTLE_MS);
  }

  private async handle(full: string): Promise<void> {
    try {
      const config = this.deps.getConfig();
      if (isCapturePaused(config.pausedUntil, new Date())) return;

      const stat = statSync(full);
      if (!stat.isFile()) return;
      if (Date.now() - stat.mtimeMs > SCREENSHOT_MAX_AGE_MS) return; // pre-existing / old file

      const key = `${full}:${Math.round(stat.mtimeMs)}`;
      if (this.processed.has(key)) return;
      this.processed.add(key);
      if (this.processed.size > 5000) this.processed.clear();

      if (stat.size > MAX_INLINE_CAPTURE_BYTES) {
        log.info("[screenshot] exceeds size cap, skipping", { full, bytes: stat.size });
        return;
      }
      if (
        !shouldCaptureFromApp(SCREENSHOT_SOURCE_APP, {
          allowlist: config.allowlist,
          denylist: config.denylist,
        })
      ) {
        log.debug("[screenshot] skipped by allow/deny");
        return;
      }

      const filename = path.basename(full);
      const bytes = readFileSync(full);
      this.deps.enqueue({
        kind: "image",
        content: bytes.toString("base64"),
        filename,
        mimeType: mimeFromFilename(filename),
        sourceApp: SCREENSHOT_SOURCE_APP,
        capturedAt: new Date().toISOString(),
      });
      log.info("[screenshot] captured", { filename });
    } catch (err) {
      // The file may have been a transient write artifact or already removed — not an error.
      log.debug("[screenshot] handle failed", { full, error: String(err) });
    }
  }
}
