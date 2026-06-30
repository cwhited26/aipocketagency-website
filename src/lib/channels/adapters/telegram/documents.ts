// lib/channels/adapters/telegram/documents.ts — turn an attached document's bytes into text the agent
// can read (PA-CHAN-1, Channels Gateway Phase 2). Lightweight, dependency-minimal:
//   • PDF  → pdf-parse (lazy-imported via its lib entry so the package's self-test fixture never runs
//            at module load; the only added dependency, used only here).
//   • CSV  → decoded as text (no csv-parse needed — a CSV is already model-readable; we decode + trim
//            and the caller labels it so the agent knows it's tabular).
//   • code / plain text / markdown / json → decode UTF-8 as-is.
// Anything else (images, archives, binaries) is reported as unsupported rather than guessed at.
//
// Never throws: a parse failure returns a typed `unsupported`/`error` result the caller folds into a
// short "couldn't read that file" note, so a bad attachment never wedges the inbound turn. Output is
// length-capped so a huge document can't blow the model context.

import { channelLog } from "@/lib/channels/log";

// Cap extracted text so one document can't dominate the agent's context window.
export const MAX_DOCUMENT_TEXT_CHARS = 12_000;
// Refuse to even download a document larger than this (Telegram bot downloads cap at 20 MB anyway).
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export type DocumentParseResult =
  | { ok: true; text: string; truncated: boolean }
  | { ok: false; reason: string };

// Minimal typing for the lazy pdf-parse import (no @types dependency; we only read `.text`).
type PdfParseFn = (data: Buffer) => Promise<{ text: string }>;

function cap(text: string): { text: string; truncated: boolean } {
  const clean = text.trimEnd();
  if (clean.length <= MAX_DOCUMENT_TEXT_CHARS) return { text: clean, truncated: false };
  return { text: clean.slice(0, MAX_DOCUMENT_TEXT_CHARS), truncated: true };
}

// Extensions we read as UTF-8 source/text. A spreadsheet exported as .csv/.tsv reads fine as text.
const TEXT_EXTENSIONS = new Set([
  "txt", "md", "markdown", "csv", "tsv", "json", "yaml", "yml", "xml", "html", "htm",
  "js", "jsx", "ts", "tsx", "py", "rb", "go", "rs", "java", "c", "h", "cpp", "cs", "php",
  "sh", "bash", "zsh", "sql", "css", "scss", "toml", "ini", "env", "log", "tex", "swift", "kt",
]);

function extensionOf(fileName: string | null): string | null {
  if (!fileName) return null;
  const dot = fileName.lastIndexOf(".");
  if (dot < 0 || dot === fileName.length - 1) return null;
  return fileName.slice(dot + 1).toLowerCase();
}

function isPdf(fileName: string | null, mimeType: string | null): boolean {
  if (mimeType === "application/pdf") return true;
  return extensionOf(fileName) === "pdf";
}

function isTextLike(fileName: string | null, mimeType: string | null): boolean {
  if (mimeType && (mimeType.startsWith("text/") || mimeType === "application/json")) return true;
  const ext = extensionOf(fileName);
  return ext !== null && TEXT_EXTENSIONS.has(ext);
}

async function parsePdf(buffer: Buffer): Promise<DocumentParseResult> {
  try {
    // Lazy + lib entry: avoids pdf-parse's index.js debug self-read and keeps the dep out of the
    // bundle until a PDF actually arrives.
    const mod = (await import("pdf-parse/lib/pdf-parse.js")) as unknown as
      | PdfParseFn
      | { default: PdfParseFn };
    const pdfParse: PdfParseFn = typeof mod === "function" ? mod : mod.default;
    const out = await pdfParse(buffer);
    const text = out.text.trim();
    if (!text) return { ok: false, reason: "no_text_in_pdf" };
    const capped = cap(text);
    return { ok: true, text: capped.text, truncated: capped.truncated };
  } catch (err) {
    channelLog.warn("telegram pdf parse failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, reason: "pdf_parse_failed" };
  }
}

/**
 * Extract readable text from a downloaded document. `fileName` + `mimeType` decide the strategy.
 * Returns `unsupported` for binary types we won't guess at.
 */
export async function parseDocument(args: {
  buffer: Buffer;
  fileName: string | null;
  mimeType: string | null;
}): Promise<DocumentParseResult> {
  const { buffer, fileName, mimeType } = args;
  if (buffer.byteLength === 0) return { ok: false, reason: "empty_file" };

  if (isPdf(fileName, mimeType)) return parsePdf(buffer);

  if (isTextLike(fileName, mimeType)) {
    const decoded = buffer.toString("utf8");
    if (!decoded.trim()) return { ok: false, reason: "empty_text" };
    const capped = cap(decoded);
    return { ok: true, text: capped.text, truncated: capped.truncated };
  }

  return { ok: false, reason: "unsupported_type" };
}
