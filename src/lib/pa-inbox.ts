import { randomUUID } from "crypto";

export type InboxKind = "text" | "url" | "note" | "voice";

export type InboxEntry = {
  id: string;
  ts: string;
  kind: InboxKind;
  title?: string;
  sourceUrl?: string;
  content: string;
  // Set when the entry is its own file in the repo (the iOS Working Copy share
  // path: sessions/inbox/share-*.md) rather than a block inside memory/inbox.md.
  // Removal of these entries deletes the file at `path` instead of rewriting a block.
  path?: string;
};

const ENTRY_START_RE = /^<!-- PA-INBOX (.+) -->$/;
const ENTRY_END = "<!-- /PA-INBOX -->";
const FILE_HEADER =
  "# Brain Inbox\n\nShared items from your iOS Shortcut — triage when ready.\n";

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

    let meta: Partial<InboxEntry> & Record<string, string>;
    try {
      meta = JSON.parse(startMatch[1]) as Partial<InboxEntry> & Record<string, string>;
    } catch {
      i++;
      continue;
    }

    if (!meta.id || !meta.ts || !meta.kind) {
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

    entries.push({
      id: meta.id,
      ts: meta.ts,
      kind: meta.kind as InboxKind,
      ...(meta.title ? { title: meta.title } : {}),
      ...(meta.sourceUrl ? { sourceUrl: meta.sourceUrl } : {}),
      content: contentLines.join("\n").trim(),
    });
  }

  return entries;
}

function entryToBlock(entry: InboxEntry): string {
  const meta: Record<string, string> = {
    id: entry.id,
    ts: entry.ts,
    kind: entry.kind,
  };
  if (entry.title) meta.title = entry.title;
  if (entry.sourceUrl) meta.sourceUrl = entry.sourceUrl;
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
  payload: { kind: InboxKind; content: string; title?: string; sourceUrl?: string },
): { content: string; entry: InboxEntry } {
  const existing = parseRaw(existingRaw);
  const entry: InboxEntry = {
    id: randomUUID(),
    ts: new Date().toISOString(),
    kind: payload.kind,
    content: payload.content.slice(0, 50_000),
    ...(payload.title ? { title: payload.title.slice(0, 500) } : {}),
    ...(payload.sourceUrl ? { sourceUrl: payload.sourceUrl } : {}),
  };
  return { content: serializeInboxFile([...existing, entry]), entry };
}

// Removes one entry by id, returns new file content.
export function removeEntryFromRaw(existingRaw: string, id: string): string {
  const existing = parseRaw(existingRaw);
  const filtered = existing.filter((e) => e.id !== id);
  return serializeInboxFile(filtered);
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

export function parseShareSheetFile(path: string, raw: string): InboxEntry | null {
  if (!raw.trim()) return null;
  const { fm, body } = parseFrontmatter(raw);

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

  return {
    id: path, // file path is the stable, unique id for file-backed entries
    ts: iso ?? new Date(0).toISOString(),
    kind: sourceUrl ? "url" : "note",
    ...(tag ? { title: tag } : {}),
    ...(sourceUrl ? { sourceUrl } : {}),
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
  const { fm, body } = parseFrontmatter(raw);

  const transcript = body.trim();
  const topic = fm.topic?.trim() || undefined;
  const content = transcript || topic || "(empty voice memo)";

  // captured_at is a full ISO timestamp; fall back to the date embedded in the
  // path so the entry still sorts sensibly if frontmatter is malformed.
  const iso =
    capturedAtToIso(fm.captured_at ?? "") ??
    capturedAtToIso(path.split("/").slice(-2, -1)[0] ?? "");

  return {
    id: path, // file path is the stable, unique id for file-backed entries
    ts: iso ?? new Date(0).toISOString(),
    kind: "voice",
    ...(topic ? { title: topic } : {}),
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
