// Background uploader — every 30s it prunes the queue, then batch-POSTs unsynced captures to
// POST /api/capture/mac-sync with the user's API token. The server returns a per-item status; items
// it accepted, deduped, or permanently rejected are marked synced locally, while transient "error"
// items stay queued for the next cycle. A single big binary is sent alone to stay under the body cap.

import type { CaptureQueue } from "../db/queue";
import type { AppConfig } from "../config";
import type { MacSyncWireItem, QueuedCapture, SyncItemResult } from "../../shared/types";
import { UPLOAD_INTERVAL_MS, UPLOAD_MAX_ITEMS, UPLOAD_BATCH_BYTE_BUDGET } from "../../shared/constants";
import log from "../logger";

export interface UploaderDeps {
  getConfig: () => AppConfig;
  queue: CaptureQueue;
  getToken: () => Promise<string | null>;
}

interface SyncResponse {
  success: boolean;
  accepted: number;
  duplicates: number;
  results: SyncItemResult[];
}

function toWire(capture: QueuedCapture): MacSyncWireItem {
  return {
    kind: capture.kind,
    content: capture.content,
    filename: capture.filename,
    mimeType: capture.mimeType,
    sourceApp: capture.sourceApp,
    capturedAt: capture.capturedAt,
    hash: capture.hash,
  };
}

/** Rough wire size of one item (content dominates; +200 for the JSON envelope). */
function estimateItemBytes(capture: QueuedCapture): number {
  return capture.content.length + (capture.filename?.length ?? 0) + 200;
}

/** Greedily fill a batch under the byte budget; always include at least one item. */
export function buildBatch(pending: QueuedCapture[]): QueuedCapture[] {
  const batch: QueuedCapture[] = [];
  let total = 0;
  for (const capture of pending) {
    const size = estimateItemBytes(capture);
    if (batch.length > 0 && total + size > UPLOAD_BATCH_BYTE_BUDGET) break;
    batch.push(capture);
    total += size;
    if (size > UPLOAD_BATCH_BYTE_BUDGET) break; // an oversized single item goes on its own
  }
  return batch;
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

export class Uploader {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly deps: UploaderDeps) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.runOnce();
    }, UPLOAD_INTERVAL_MS);
    log.info("[uploader] started");
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
    log.info("[uploader] stopped");
  }

  /** Run one upload cycle. Safe to call manually (Sync now); overlapping calls are ignored. */
  async runOnce(): Promise<{ synced: number; pruned: number }> {
    if (this.running) return { synced: 0, pruned: 0 };
    this.running = true;
    try {
      const pruned = this.deps.queue.prune(new Date());
      const token = await this.deps.getToken();
      if (!token) {
        log.debug("[uploader] no API token set; skipping sync");
        return { synced: 0, pruned };
      }
      const pending = this.deps.queue.pending(UPLOAD_MAX_ITEMS);
      if (pending.length === 0) return { synced: 0, pruned };

      const batch = buildBatch(pending);
      const response = await this.postBatch(token, batch);
      if (!response) return { synced: 0, pruned };

      const doneHashes = response.results
        .filter((r) => r.status === "accepted" || r.status === "duplicate" || r.status === "rejected")
        .map((r) => r.hash);
      this.deps.queue.markSyncedByHash(doneHashes);
      log.info("[uploader] cycle complete", {
        accepted: response.accepted,
        duplicates: response.duplicates,
        marked: doneHashes.length,
      });
      return { synced: doneHashes.length, pruned };
    } finally {
      this.running = false;
    }
  }

  private async postBatch(token: string, batch: QueuedCapture[]): Promise<SyncResponse | null> {
    const config = this.deps.getConfig();
    const url = `${config.apiBaseUrl}/api/capture/mac-sync`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ items: batch.map(toWire) }),
      });
      if (res.status === 401) {
        log.error("[uploader] token rejected (401) — re-paste your API token in Settings");
        return null;
      }
      if (res.status === 409) {
        log.info("[uploader] no brain connected yet; keeping items queued");
        return null;
      }
      if (!res.ok) {
        log.error("[uploader] sync request failed", { status: res.status, body: await safeText(res) });
        return null;
      }
      const json = (await res.json()) as SyncResponse;
      if (!json.success || !Array.isArray(json.results)) {
        log.error("[uploader] unexpected response shape");
        return null;
      }
      return json;
    } catch (err) {
      log.error("[uploader] network error", { error: String(err) });
      return null;
    }
  }
}
