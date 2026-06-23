// parse.ts — pure helpers for the PWA Web Share Target (PC-CORE-1).
//
// The iOS / Android share sheet POSTs a `multipart/form-data` body to /capture/share with the
// fields declared in public/manifest.webmanifest's `share_target.params`: a `title`, a `text`, a
// `url`, and zero or more `files`. This module turns that raw FormData into a normalized shape and
// folds the text fields into a single capture body — no I/O, so it is safe to unit test directly.

import { MAX_UPLOAD_BYTES } from "@/lib/brain/absorb";
import type { InboxKind } from "@/lib/pa-inbox";

/** One file attached to a share, already read into memory. */
export type SharedFile = {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
};

/** The text fields a share carries (any subset may be present). */
export type ShareFields = {
  title?: string;
  text?: string;
  url?: string;
};

/** A fully-parsed share: normalized text fields plus any attached files. */
export type ParsedShare = ShareFields & {
  files: SharedFile[];
  /** Files that were dropped while parsing (too large / empty), for the caller to surface. */
  skipped: { fileName: string; reason: "empty" | "too-large" }[];
};

/** Trim a form value to a bounded string, or undefined when blank. */
function cleanField(value: FormDataEntryValue | null, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, max);
}

/**
 * Parse the share-sheet `multipart/form-data` form into normalized fields + files. Reads every
 * `files` entry into a Buffer; drops empty files and anything over MAX_UPLOAD_BYTES (recorded in
 * `skipped` so the route can tell the owner). Never throws on a missing field — a share may carry
 * only a title, only a url, only files, etc.
 */
export async function parseShareForm(form: FormData): Promise<ParsedShare> {
  const title = cleanField(form.get("title"), 500);
  const text = cleanField(form.get("text"), 50_000);
  const url = cleanField(form.get("url"), 2_000);

  const files: SharedFile[] = [];
  const skipped: ParsedShare["skipped"] = [];

  for (const entry of form.getAll("files")) {
    if (!(entry instanceof File)) continue;
    const fileName = entry.name || "shared-file";
    if (entry.size === 0) {
      skipped.push({ fileName, reason: "empty" });
      continue;
    }
    if (entry.size > MAX_UPLOAD_BYTES) {
      skipped.push({ fileName, reason: "too-large" });
      continue;
    }
    const buffer = Buffer.from(await entry.arrayBuffer());
    files.push({ fileName, mimeType: entry.type || "application/octet-stream", buffer });
  }

  return {
    ...(title ? { title } : {}),
    ...(text ? { text } : {}),
    ...(url ? { url } : {}),
    files,
    skipped,
  };
}

/**
 * Concatenate the supplied text fields into one capture body (title, then text, then url — each on
 * its own line, blanks omitted). Returns "" when no text field is present (a files-only share); the
 * caller decides the fallback body in that case.
 */
export function buildCaptureBody(fields: ShareFields): string {
  return [fields.title, fields.text, fields.url].filter(Boolean).join("\n").trim();
}

/** A share carrying a URL is a "url" capture (so the dashboard renders the link); otherwise "note". */
export function pickShareKind(fields: ShareFields): Extract<InboxKind, "url" | "note"> {
  return fields.url ? "url" : "note";
}
