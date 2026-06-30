// Tunables shared across the main process.

/** Max bytes for an inline binary capture. Kept so base64 (~+33%) stays under Vercel's ~4.5MB
 *  request body cap. Larger screenshots/files are skipped with a log line (v1.1: signed-URL upload). */
export const MAX_INLINE_CAPTURE_BYTES = 3 * 1024 * 1024;

/** Clipboard poll interval. */
export const CLIPBOARD_POLL_MS = 1000;

/** Uploader cycle interval. */
export const UPLOAD_INTERVAL_MS = 30_000;

/** A screenshot file is only captured if it appeared within this window (avoids re-ingesting old
 *  files when the watcher (re)starts). */
export const SCREENSHOT_MAX_AGE_MS = 60_000;

/** Max items pulled from the queue per upload cycle. */
export const UPLOAD_MAX_ITEMS = 50;

/** Approximate byte budget for one upload request body (keeps a batch under the platform cap). */
export const UPLOAD_BATCH_BYTE_BUDGET = 3_800_000;
