// Local capture queue backed by SQLite (better-sqlite3, synchronous). Captures are enqueued by the
// watchers, drained by the uploader, and pruned after the retention window. Dedup is enforced at the
// DB level: hash is UNIQUE, so an INSERT OR IGNORE makes a re-detected capture a no-op.

import Database from "better-sqlite3";
import { computeContentHash } from "../capture/hash";
import { selectPrunableIds } from "../capture/prune";
import type { NewCapture, QueuedCapture } from "../../shared/types";
import log from "../logger";

interface CaptureDbRow {
  id: number;
  kind: string;
  content: string;
  filename: string | null;
  mime_type: string | null;
  source_app: string | null;
  captured_at: string;
  hash: string;
  synced: number;
  synced_at: string | null;
  created_at: string;
}

function rowToCapture(row: CaptureDbRow): QueuedCapture {
  return {
    id: row.id,
    kind: row.kind as QueuedCapture["kind"],
    content: row.content,
    filename: row.filename,
    mimeType: row.mime_type,
    sourceApp: row.source_app,
    capturedAt: row.captured_at,
    hash: row.hash,
    synced: row.synced === 1,
    syncedAt: row.synced_at,
    createdAt: row.created_at,
  };
}

export class CaptureQueue {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS captures (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        kind        TEXT NOT NULL,
        content     TEXT NOT NULL,
        filename    TEXT,
        mime_type   TEXT,
        source_app  TEXT,
        captured_at TEXT NOT NULL,
        hash        TEXT NOT NULL UNIQUE,
        synced      INTEGER NOT NULL DEFAULT 0,
        synced_at   TEXT,
        created_at  TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS captures_unsynced_idx ON captures (synced, id);
    `);
  }

  /** Enqueue a capture. Returns the hash and whether it was newly inserted (false = duplicate). */
  enqueue(capture: NewCapture): { hash: string; inserted: boolean } {
    const hash = computeContentHash({
      kind: capture.kind,
      content: capture.content,
      filename: capture.filename,
    });
    const info = this.db
      .prepare(
        `INSERT OR IGNORE INTO captures
           (kind, content, filename, mime_type, source_app, captured_at, hash, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        capture.kind,
        capture.content,
        capture.filename,
        capture.mimeType,
        capture.sourceApp,
        capture.capturedAt,
        hash,
        new Date().toISOString(),
      );
    return { hash, inserted: info.changes > 0 };
  }

  /** Oldest unsynced captures, up to `limit`. */
  pending(limit: number): QueuedCapture[] {
    const rows = this.db
      .prepare(`SELECT * FROM captures WHERE synced = 0 ORDER BY id ASC LIMIT ?`)
      .all(limit) as CaptureDbRow[];
    return rows.map(rowToCapture);
  }

  /** Mark captures synced (by hash, which is what the server reports back). */
  markSyncedByHash(hashes: string[]): void {
    if (hashes.length === 0) return;
    const now = new Date().toISOString();
    const stmt = this.db.prepare(
      `UPDATE captures SET synced = 1, synced_at = ? WHERE hash = ? AND synced = 0`,
    );
    const tx = this.db.transaction((items: string[]) => {
      for (const h of items) stmt.run(now, h);
    });
    tx(hashes);
  }

  /** Delete synced captures older than the retention window. Returns the count pruned. */
  prune(now: Date): number {
    const rows = this.db.prepare(`SELECT id, synced, synced_at FROM captures`).all() as Pick<
      CaptureDbRow,
      "id" | "synced" | "synced_at"
    >[];
    const ids = selectPrunableIds(
      rows.map((r) => ({ id: r.id, synced: r.synced === 1, syncedAt: r.synced_at })),
      now,
    );
    if (ids.length === 0) return 0;
    const stmt = this.db.prepare(`DELETE FROM captures WHERE id = ?`);
    const tx = this.db.transaction((items: number[]) => {
      for (const id of items) stmt.run(id);
    });
    tx(ids);
    log.info("[queue] pruned synced captures", { count: ids.length });
    return ids.length;
  }

  stats(): { pending: number; synced: number; total: number } {
    const row = this.db
      .prepare(
        `SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN synced = 0 THEN 1 ELSE 0 END) AS pending,
           SUM(CASE WHEN synced = 1 THEN 1 ELSE 0 END) AS synced
         FROM captures`,
      )
      .get() as { total: number; pending: number | null; synced: number | null };
    return { total: row.total, pending: row.pending ?? 0, synced: row.synced ?? 0 };
  }

  close(): void {
    this.db.close();
  }
}
