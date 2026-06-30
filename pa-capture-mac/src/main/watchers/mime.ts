// Minimal extension → MIME mapping for captured files (no dependency on a mime library).

import path from "node:path";

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".csv": "text/csv",
  ".json": "application/json",
  ".zip": "application/zip",
};

export function mimeFromFilename(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

/** True when the filename has an image extension the screenshot watcher captures. */
export function isScreenshotImage(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return ext === ".png" || ext === ".jpg" || ext === ".jpeg";
}
