// Clipboard watcher — polls the system clipboard once a second. On a real change it snapshots the
// content (text / url / image / copied file), tags it with the frontmost app (active-win), gates it
// through pause + allow/deny, and enqueues it. Dedup is the queue's job (UNIQUE hash); a cheap
// per-tick signature avoids rebuilding heavy image/file content while the same item lingers.

import { clipboard } from "electron";
import activeWindow from "active-win";
import { statSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { AppConfig } from "../config";
import type { NewCapture, CaptureKind } from "../../shared/types";
import { isCapturePaused } from "../capture/pause";
import { shouldCaptureFromApp } from "../capture/filter";
import { mimeFromFilename } from "./mime";
import { CLIPBOARD_POLL_MS, MAX_INLINE_CAPTURE_BYTES } from "../../shared/constants";
import log from "../logger";

interface ClipboardCandidate {
  kind: CaptureKind;
  content: string;
  filename: string | null;
  mimeType: string | null;
}

export interface ClipboardWatcherDeps {
  getConfig: () => AppConfig;
  enqueue: (capture: NewCapture) => void;
}

/** A single-token http(s) URL (not free text that merely contains a link). */
function looksLikeUrl(text: string): boolean {
  if (/\s/.test(text)) return false;
  if (!/^https?:\/\//i.test(text)) return false;
  try {
    new URL(text);
    return true;
  } catch {
    return false;
  }
}

export class ClipboardWatcher {
  private timer: NodeJS.Timeout | null = null;
  private lastSignature: string | null = null;

  constructor(private readonly deps: ClipboardWatcherDeps) {}

  start(): void {
    if (this.timer) return;
    // Seed the signature so the item already on the clipboard at launch isn't captured retroactively.
    this.lastSignature = this.signature();
    this.timer = setInterval(() => {
      void this.tick();
    }, CLIPBOARD_POLL_MS);
    log.info("[clipboard] watcher started");
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
    log.info("[clipboard] watcher stopped");
  }

  isRunning(): boolean {
    return this.timer !== null;
  }

  /** A cheap fingerprint of the current clipboard, used only to detect change before heavy work. */
  private signature(): string {
    const formats = clipboard.availableFormats();
    if (formats.some((f) => f.startsWith("image/"))) {
      const size = clipboard.readImage().getSize();
      return `image:${size.width}x${size.height}`;
    }
    const fileUrl = clipboard.read("public.file-url");
    if (fileUrl) return `file:${fileUrl}`;
    return `text:${clipboard.readText()}`;
  }

  private async tick(): Promise<void> {
    try {
      const config = this.deps.getConfig();
      if (isCapturePaused(config.pausedUntil, new Date())) return;

      const sig = this.signature();
      if (sig === this.lastSignature) return;
      this.lastSignature = sig;

      const candidate = this.readCandidate();
      if (!candidate) return;

      let sourceApp: string | null = null;
      try {
        const win = await activeWindow();
        sourceApp = win?.owner?.name ?? null;
      } catch (err) {
        log.debug("[clipboard] active-win failed", { error: String(err) });
      }

      if (!shouldCaptureFromApp(sourceApp, { allowlist: config.allowlist, denylist: config.denylist })) {
        log.debug("[clipboard] skipped by allow/deny", { sourceApp });
        return;
      }

      this.deps.enqueue({
        kind: candidate.kind,
        content: candidate.content,
        filename: candidate.filename,
        mimeType: candidate.mimeType,
        sourceApp,
        capturedAt: new Date().toISOString(),
      });
      log.info("[clipboard] captured", { kind: candidate.kind, sourceApp });
    } catch (err) {
      log.error("[clipboard] tick failed", { error: String(err) });
    }
  }

  /** Build a capture candidate from the clipboard, or null when there's nothing (new) to capture. */
  private readCandidate(): ClipboardCandidate | null {
    const image = clipboard.readImage();
    if (!image.isEmpty()) {
      const png = image.toPNG();
      if (png.length > MAX_INLINE_CAPTURE_BYTES) {
        log.info("[clipboard] image exceeds size cap, skipping", { bytes: png.length });
        return null;
      }
      return {
        kind: "image",
        content: png.toString("base64"),
        filename: `clipboard-${Date.now()}.png`,
        mimeType: "image/png",
      };
    }

    const fileUrl = clipboard.read("public.file-url");
    if (fileUrl && fileUrl.startsWith("file:")) {
      return this.readFileCandidate(fileUrl);
    }

    const text = clipboard.readText().trim();
    if (!text) return null;
    if (looksLikeUrl(text)) {
      return { kind: "url", content: text, filename: null, mimeType: null };
    }
    return { kind: "text", content: text, filename: null, mimeType: null };
  }

  private readFileCandidate(fileUrl: string): ClipboardCandidate | null {
    try {
      const filePath = fileURLToPath(fileUrl);
      const stat = statSync(filePath);
      if (!stat.isFile()) return null;
      if (stat.size > MAX_INLINE_CAPTURE_BYTES) {
        log.info("[clipboard] copied file exceeds size cap, skipping", {
          path: filePath,
          bytes: stat.size,
        });
        return null;
      }
      const bytes = readFileSync(filePath);
      const filename = path.basename(filePath);
      return {
        kind: "file",
        content: bytes.toString("base64"),
        filename,
        mimeType: mimeFromFilename(filename),
      };
    } catch (err) {
      log.debug("[clipboard] could not read copied file", { error: String(err) });
      return null;
    }
  }
}
