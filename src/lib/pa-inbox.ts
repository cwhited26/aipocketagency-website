import { randomUUID } from "crypto";
import { z } from "zod";

export type InboxKind = "text" | "url" | "note" | "voice";

export type InboxEntry = {
  id: string;
  ts: string;
  kind: InboxKind;
  title?: string;
  sourceUrl?: string;
  content: string;
  // The capture surface this entry came in through (e.g. "share_sheet" for the PWA
  // Web Share Target, "ios_share" for the Working Copy shortcut). Optional and purely
  // descriptive — the Capture Inbox / dashboard reads it to show a per-surface icon.
  // Absent on older entries, which render with the default icon.
  source?: string;
  // Owner-applied labels, edited from the Captures dashboard (PC-CORE-6). Absent on
  // entries that have never been tagged; an empty array is normalized away on write.
  tags?: string[];
  // Soft-delete tombstone (PC-CORE-6). When set, the block stays in memory/inbox.md
  // (brain history is preserved) but the dashboard hides it. Absent on live entries.
  deletedAt?: string;
  // Set when the entry is its own file in the repo (the iOS Working Copy share
  // path: sessions/inbox/share-*.md) rather than a block inside memory/inbox.md.
  // Removal of these entries deletes the file at `path` instead of rewriting a block.
  path?: string;
  // Set once a share-extension file has been promoted into assets/ (the canonical
  // capture location that Documents reflects). Drives the "View in Documents →" link.
  assetPath?: string;
  // Optional http(s) URL to a playable audio file for a voice capture (from the memo's
  // `audio_url` / `audio` frontmatter). Absent on transcript-only memos — the dashboard
  // renders an <audio> player only when this is present, else the transcript alone.
  audioUrl?: string;
};

const ENTRY_START_RE = /^<!-- PA-INBOX (.+) -->$/;
const ENTRY_END = "<!-- /PA-INBOX -->";
const FILE_HEADER =
  "# Brain Inbox\n\nShared items from your iOS Shortcut — triage when ready.\n";

// Narrow an unknown JSON value to a non-empty string (meta values arrive untyped from JSON.parse).
function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

// Narrow an unknown JSON value to an array of non-empty strings (the meta `tags` field).
function asStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v.filter((t): t is string => typeof t === "string" && t.length > 0);
  return out.length > 0 ? out : undefined;
}

/**
 * Normalize owner-supplied tags: trim, clamp each to 40 chars, drop blanks, dedupe
 * case-insensitively (keeping first spelling), cap at 20. Pure → unit-tested. Used by the
 * dashboard's tag-edit route so the brain file never accumulates junk or unbounded tags.
 */
export function normalizeTags(tags: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of tags) {
    const t = raw.trim().slice(0, 40);
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= 20) break;
  }
  return out;
}

function parseRaw(raw: string): InboxEntry[] {
  const lines = raw.split("\n");
  const entries: InboxEntry[] = [];
  let i = 0;

  while (i < lines.length) {
    const startMatch = ENTRY_START_RE.exec(lines[i]);
    if (!startMatch) {
      i++;
      continue;
    }

    let meta: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(startMatch[1]);
      if (typeof parsed !== "object" || parsed === null) {
        i++;
        continue;
      }
      meta = parsed as Record<string, unknown>;
    } catch {
      i++;
      continue;
    }

    const id = asString(meta.id);
    const ts = asString(meta.ts);
    const kind = asString(meta.kind);
    if (!id || !ts || !kind) {
      i++;
      continue;
    }

    const contentLines: string[] = [];
    i++;
    while (i < lines.length && lines[i] !== ENTRY_END) {
      contentLines.push(lines[i]);
      i++;
    }
    i++; // skip /PA-INBOX line

    const title = asString(meta.title);
    const sourceUrl = asString(meta.sourceUrl);
    const source = asString(meta.source);
    const tags = asStringArray(meta.tags);
    const deletedAt = asString(meta.deletedAt);

    entries.push({
      id,
      ts,
      kind: kind as InboxKind,
      ...(title ? { title } : {}),
      ...(sourceUrl ? { sourceUrl } : {}),
      ...(source ? { source } : {}),
      ...(tags && tags.length ? { tags } : {}),
      ...(deletedAt ? { deletedAt } : {}),
      content: contentLines.join("\n").trim(),
    });
  }

  return entries;
}

function entryToBlock(entry: InboxEntry): string {
  const meta: Record<string, unknown> = {
    id: entry.id,
    ts: entry.ts,
    kind: entry.kind,
  };
  if (entry.title) meta.title = entry.title;
  if (entry.sourceUrl) meta.sourceUrl = entry.sourceUrl;
  if (entry.source) meta.source = entry.source;
  if (entry.tags && entry.tags.length) meta.tags = entry.tags;
  if (entry.deletedAt) meta.deletedAt = entry.deletedAt;
  return `<!-- PA-INBOX ${JSON.stringify(meta)} -->\n${entry.content}\n<!-- /PA-INBOX -->`;
}

// Returns entries newest-first for display.
export function parseInboxForDisplay(raw: string): InboxEntry[] {
  return parseRaw(raw).reverse();
}

// Serializes entries back to file format (chronological order in the file).
function serializeInboxFile(entries: InboxEntry[]): string {
  const sorted = [...entries].sort((a, b) => a.ts.localeCompare(b.ts));
  if (sorted.length === 0) return FILE_HEADER.trimEnd() + "\n";
  return FILE_HEADER + "\n" + sorted.map(entryToBlock).join("\n\n") + "\n";
}

// Appends a new entry to the raw file content.
export function appendEntryToRaw(
  existingRaw: string,
  payload: {
    kind: InboxKind;
    content: string;
    title?: string;
    sourceUrl?: string;
    source?: string;
  },
): { content: string; entry: InboxEntry } {
  const existing = parseRaw(existingRaw);
  const entry: InboxEntry = {
    id: randomUUID(),
    ts: new Date().toISOString(),
    kind: payload.kind,
    content: payload.content.slice(0, 50_000),
    ...(payload.title ? { title: payload.title.slice(0, 500) } : {}),
    ...(payload.sourceUrl ? { sourceUrl: payload.sourceUrl } : {}),
    ...(payload.source ? { source: payload.source } : {}),
  };
  return { content: serializeInboxFile([...existing, entry]), entry };
}

// Removes one entry by id, returns new file content.
export function removeEntryFromRaw(existingRaw: string, id: string): string {
  const existing = parseRaw(existingRaw);
  const filtered = existing.filter((e) => e.id !== id);
  return serializeInboxFile(filtered);
}

/**
 * Soft-deletes one entry by id: stamps `deletedAt` so the dashboard hides it, but leaves the block
 * in the file (brain history is preserved — PC-CORE-6's chosen delete semantics). Idempotent: a
 * re-delete keeps the original tombstone time. A missing id is a no-op (returns the file unchanged
 * in content, normalized through the serializer). Pure → unit-tested.
 */
export function softDeleteEntryInRaw(
  existingRaw: string,
  id: string,
  nowIso = new Date().toISOString(),
): string {
  const existing = parseRaw(existingRaw);
  const updated = existing.map((e) =>
    e.id === id && !e.deletedAt ? { ...e, deletedAt: nowIso } : e,
  );
  return serializeInboxFile(updated);
}

/**
 * Replaces the tags on one entry by id (normalized; an empty result clears the field). A missing id
 * is a no-op. Pure → unit-tested. The dashboard's tag editor commits the result back to the file.
 */
export function setEntryTagsInRaw(existingRaw: string, id: string, tags: string[]): string {
  const cleaned = normalizeTags(tags);
  const existing = parseRaw(existingRaw);
  const updated = existing.map((e) =>
    e.id === id ? { ...e, tags: cleaned.length ? cleaned : undefined } : e,
  );
  return serializeInboxFile(updated);
}

/** True when the entry has been soft-deleted (tombstoned). */
export function isDeleted(entry: InboxEntry): boolean {
  return Boolean(entry.deletedAt);
}

// ─── iOS Working Copy share files (sessions/inbox/share-*.md) ──────────────────
// The native iOS Share Sheet shortcut commits each item directly to the repo as
// its own file via Working Copy (see automations/brain-inbox-shortcut-recipe.md
// "Path 1"). That format differs from the API endpoint's PA-INBOX blocks:
//
//   ---
//   source: ios-share-sheet
//   tag: <free-text title>
//   captured_at: 2026-06-02-160956
//   ---
//
//   URL: https://...
//
//   (No notes — captured from Share Sheet)
//
// parseShareSheetFile turns one such file into an InboxEntry so the Capture
// Inbox can render items captured this way alongside endpoint-captured ones.

const NO_NOTES_RE = /^\(no notes\b/i;

// Repo plumbing that can sit inside an inbox directory but is not a capture: a
// README explaining the folder, a .gitkeep placeholder, etc. These carry no
// capture date, so without this guard they'd render as epoch-dated ("Dec 31,
// 1969") items in the Capture Inbox. Skip them only when they also lack any
// date frontmatter — a genuine note literally named README.md with a
// captured_at still shows up.
const PLUMBING_NAME_RE = /^(_?readme\.md|\.gitkeep|\.gitignore)$/i;

function isRepoPlumbingFile(path: string, fm: Record<string, string>): boolean {
  const name = path.split("/").pop() ?? "";
  const hasDate = Boolean(fm.captured_at || fm.created_at || fm.date);
  return PLUMBING_NAME_RE.test(name) && !hasDate;
}

// captured_at is "YYYY-MM-DD-HHMMSS" (sometimes just "YYYY-MM-DD"). Convert to a
// Date-parseable ISO-ish string; returns null if it doesn't look like a date.
function capturedAtToIso(raw: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[-T](\d{2})(\d{2})(\d{2}))?/.exec(raw.trim());
  if (!m) return null;
  const [, y, mo, d, hh = "00", mm = "00", ss = "00"] = m;
  return `${y}-${mo}-${d}T${hh}:${mm}:${ss}`;
}

function parseFrontmatter(raw: string): { fm: Record<string, string>; body: string } {
  const fm: Record<string, string> = {};
  if (!raw.startsWith("---")) return { fm, body: raw };
  const lines = raw.split("\n");
  let i = 1;
  for (; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      i++;
      break;
    }
    const m = /^([^:]+):\s*(.*)$/.exec(lines[i]);
    if (m) fm[m[1].trim()] = m[2].trim();
  }
  return { fm, body: lines.slice(i).join("\n") };
}

// The frontmatter the file-backed capture surfaces (iOS share + voice recorder) can carry. Every
// field is an optional string — frontmatter is plain `key: value` text — and unknown keys are kept
// (`catchall`) so a parse never drops fields the owner or a future surface adds. This is the Zod
// boundary the dashboard relies on: a malformed block falls back to {} rather than throwing.
const FileFrontmatterSchema = z
  .object({
    captured_at: z.string().optional(),
    created_at: z.string().optional(),
    date: z.string().optional(),
    source: z.string().optional(),
    kind: z.string().optional(),
    tag: z.string().optional(),
    topic: z.string().optional(),
    duration_seconds: z.string().optional(),
    // Optional URL to a playable audio file for a voice memo (the in-app recorder can attach one).
    audio_url: z.string().optional(),
    audio: z.string().optional(),
    // Soft-delete tombstone stamped by the Captures dashboard onto a file-backed capture.
    deleted_at: z.string().optional(),
    // Owner-applied labels, comma-separated (frontmatter has no native list type here).
    tags: z.string().optional(),
  })
  .catchall(z.string());

type FileFrontmatter = z.infer<typeof FileFrontmatterSchema>;

// Validate a parsed frontmatter record at the boundary; an invalid shape degrades to {} (no throw).
function validateFrontmatter(fm: Record<string, string>): FileFrontmatter {
  const parsed = FileFrontmatterSchema.safeParse(fm);
  return parsed.success ? parsed.data : {};
}

// Split a comma-separated frontmatter `tags` value (optionally `[a, b]`-bracketed, quoted) into
// normalized tags. Pure → unit-tested.
function parseFrontmatterTags(raw: string | undefined): string[] {
  if (!raw) return [];
  const inner = raw.trim().replace(/^\[/, "").replace(/\]$/, "");
  return normalizeTags(inner.split(",").map((t) => t.replace(/^["']|["']$/g, "")));
}

export function parseShareSheetFile(path: string, raw: string): InboxEntry | null {
  if (!raw.trim()) return null;
  const { fm: rawFm, body } = parseFrontmatter(raw);
  if (isRepoPlumbingFile(path, rawFm)) return null;
  const fm = validateFrontmatter(rawFm);

  // Pull a URL out of the body (the shortcut writes "URL: https://...").
  let sourceUrl: string | undefined;
  const notes: string[] = [];
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const urlMatch = /^URL:\s*(\S+)/i.exec(trimmed);
    if (urlMatch && !sourceUrl) {
      sourceUrl = urlMatch[1];
      continue;
    }
    if (NO_NOTES_RE.test(trimmed)) continue;
    notes.push(trimmed);
  }

  const tag = fm.tag?.trim() || undefined;
  const noteText = notes.join("\n").trim();
  const content = noteText || sourceUrl || tag || "(shared item)";

  // captured_at → ts; fall back to the date embedded in the filename so the
  // entry still sorts sensibly even if frontmatter is malformed.
  const iso =
    capturedAtToIso(fm.captured_at ?? "") ??
    capturedAtToIso(path.split("/").pop()?.replace(/^share-/, "") ?? "");

  const tags = parseFrontmatterTags(fm.tags);
  const deletedAt = fm.deleted_at?.trim() || undefined;

  return {
    id: path, // file path is the stable, unique id for file-backed entries
    ts: iso ?? new Date(0).toISOString(),
    kind: sourceUrl ? "url" : "note",
    ...(tag ? { title: tag } : {}),
    ...(sourceUrl ? { sourceUrl } : {}),
    ...(tags.length ? { tags } : {}),
    ...(deletedAt ? { deletedAt } : {}),
    content,
    path,
  };
}

// ─── Voice memos (inbox/voice-memos/YYYY-MM-DD/<HHMMSS>-<slug>.md) ─────────────
// Captured by the in-app recorder (see /app/capture/voice). Each memo is its own
// file with frontmatter { captured_at, source: voice-memo, topic, duration_seconds }
// followed by the transcript body. parseVoiceMemoFile turns one into an InboxEntry
// so voice memos render in the Capture Inbox alongside every other capture source.
export function parseVoiceMemoFile(path: string, raw: string): InboxEntry | null {
  if (!raw.trim()) return null;
  const { fm: rawFm, body } = parseFrontmatter(raw);
  if (isRepoPlumbingFile(path, rawFm)) return null;
  const fm = validateFrontmatter(rawFm);

  const transcript = body.trim();
  const topic = fm.topic?.trim() || undefined;
  const content = transcript || topic || "(empty voice memo)";

  // captured_at is a full ISO timestamp; fall back to the date embedded in the
  // path so the entry still sorts sensibly if frontmatter is malformed.
  const iso =
    capturedAtToIso(fm.captured_at ?? "") ??
    capturedAtToIso(path.split("/").slice(-2, -1)[0] ?? "");

  const tags = parseFrontmatterTags(fm.tags);
  const deletedAt = fm.deleted_at?.trim() || undefined;
  // Only trust an http(s) audio URL — never a javascript:/data: scheme — before it reaches an <audio src>.
  const audioRaw = (fm.audio_url ?? fm.audio)?.trim();
  const audioUrl = audioRaw && /^https?:\/\//i.test(audioRaw) ? audioRaw : undefined;

  return {
    id: path, // file path is the stable, unique id for file-backed entries
    ts: iso ?? new Date(0).toISOString(),
    kind: "voice",
    ...(topic ? { title: topic } : {}),
    ...(tags.length ? { tags } : {}),
    ...(deletedAt ? { deletedAt } : {}),
    ...(audioUrl ? { audioUrl } : {}),
    content,
    path,
  };
}

// Merge endpoint-block entries with file-backed entries, newest first.
export function mergeInboxEntries(...groups: InboxEntry[][]): InboxEntry[] {
  return groups
    .flat()
    .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
}

// ─── File-backed capture mutation (voice memos, share files) ───────────────────
// Unlike memory/inbox.md blocks, file-backed captures are their own .md file. The Captures dashboard
// soft-deletes and re-tags them by stamping the file's YAML frontmatter (it never deletes the file —
// brain history is preserved, the same contract as the inbox.md tombstone). upsertFrontmatter is the
// pure rewrite primitive; setFileDeletedAt / setFileTags are the two operations the route commits.

/**
 * Set or remove frontmatter keys on a markdown file, preserving the body, existing key order, and any
 * keys not in `patch`. A null/empty patch value removes that key. When the file has no frontmatter, a
 * block is created above the body. Pure → unit-tested.
 */
export function upsertFrontmatter(
  raw: string,
  patch: Record<string, string | null>,
): string {
  // Split existing frontmatter (if any) from the body, keeping key order.
  let order: string[] = [];
  const values = new Map<string, string>();
  let body = raw;

  if (raw.startsWith("---")) {
    const lines = raw.split("\n");
    let i = 1;
    for (; i < lines.length; i++) {
      if (lines[i].trim() === "---") {
        i++;
        break;
      }
      const m = /^([^:]+):\s*(.*)$/.exec(lines[i]);
      if (m) {
        const key = m[1].trim();
        if (!values.has(key)) order.push(key);
        values.set(key, m[2].trim());
      }
    }
    // A leading blank line conventionally separates frontmatter from the body.
    body = lines.slice(i).join("\n").replace(/^\n/, "");
  }

  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === "") {
      values.delete(key);
      order = order.filter((k) => k !== key);
    } else {
      if (!values.has(key)) order.push(key);
      values.set(key, value);
    }
  }

  const fmLines = order.map((k) => `${k}: ${values.get(k) ?? ""}`);
  if (fmLines.length === 0) return body;
  return `---\n${fmLines.join("\n")}\n---\n\n${body}`;
}

/** Stamp a soft-delete tombstone (deleted_at) onto a file-backed capture. Idempotent re-stamp keeps
 *  the original time. Pure → unit-tested. */
export function setFileDeletedAt(raw: string, nowIso = new Date().toISOString()): string {
  const { fm } = parseFrontmatter(raw);
  const existing = fm.deleted_at?.trim();
  return upsertFrontmatter(raw, { deleted_at: existing || nowIso });
}

/** Replace the tags on a file-backed capture (normalized; an empty result clears the key). Pure. */
export function setFileTags(raw: string, tags: string[]): string {
  const cleaned = normalizeTags(tags);
  return upsertFrontmatter(raw, { tags: cleaned.length ? cleaned.join(", ") : null });
}
