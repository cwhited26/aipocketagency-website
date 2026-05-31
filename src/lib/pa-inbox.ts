import { randomUUID } from "crypto";

export type InboxKind = "text" | "url" | "note";

export type InboxEntry = {
  id: string;
  ts: string;
  kind: InboxKind;
  title?: string;
  sourceUrl?: string;
  content: string;
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
