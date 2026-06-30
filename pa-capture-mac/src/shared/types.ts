// Shared types for the Pocket Agent Capture Mac app. Used by both the main process and (type-only,
// erased at compile) anywhere that needs the capture shape. Mirrors the server's wire contract at
// POST /api/capture/mac-sync (see src/lib/pocket-capture/mac-sync.ts in the PA web app).

/** The kind of a captured item. text/url carry raw text; image/file carry base64-encoded bytes. */
export type CaptureKind = "text" | "image" | "file" | "url";

/** A capture as it is queued locally (before sync). */
export interface NewCapture {
  kind: CaptureKind;
  /** Raw text for text/url; base64 of the bytes for image/file. */
  content: string;
  filename: string | null;
  mimeType: string | null;
  /** The frontmost app the capture came from (active-win owner name), or null when unknown. */
  sourceApp: string | null;
  /** ISO timestamp of when the capture happened. */
  capturedAt: string;
}

/** A row in the local SQLite queue. */
export interface QueuedCapture extends NewCapture {
  id: number;
  /** SHA-256 hex of (kind, content, filename) — the dedup key, also sent to the server. */
  hash: string;
  synced: boolean;
  syncedAt: string | null;
  createdAt: string;
}

/** One item on the wire to POST /api/capture/mac-sync. */
export interface MacSyncWireItem {
  kind: CaptureKind;
  content: string;
  filename: string | null;
  mimeType: string | null;
  sourceApp: string | null;
  capturedAt: string;
  hash: string;
}

/** Per-item outcome returned by the server (mirror of MacItemStatus on the backend). */
export type SyncItemStatus = "accepted" | "duplicate" | "rejected" | "error";

export interface SyncItemResult {
  hash: string;
  status: SyncItemStatus;
  reason?: string;
}
