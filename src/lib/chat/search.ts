// search.ts — chat-history search, source/date filtering, and export (PA v5 Wave A).
//
// Pure functions over an in-memory ChatMessage[]. The client holds the recent window and
// runs these directly; the server reuses the same predicates so a "search the whole
// history" request and the live client view agree. No React, no DB.

import type { ChatMessage, CardKind } from "./types";

// ── Source filter ───────────────────────────────────────────────────────────────────────
// The user-facing "type" facet under the search bar. Maps to card kinds (or the plain
// conversational stream for "general").
export const SEARCH_SOURCES = [
  "all",
  "memory",
  "persona",
  "doc",
  "voice",
  "screenshot",
  "general",
] as const;
export type SearchSource = (typeof SEARCH_SOURCES)[number];

const SOURCE_TO_KINDS: Record<Exclude<SearchSource, "all" | "general">, CardKind[]> = {
  memory: ["memory_write"],
  persona: ["persona_invoke", "persona_response"],
  doc: ["doc_preview"],
  voice: ["voice_memo"],
  screenshot: ["screenshot"],
};

/** Whether a message belongs to the selected source facet. */
export function matchesSource(message: ChatMessage, source: SearchSource): boolean {
  if (source === "all") return true;
  if (source === "general") {
    // The plain conversational stream: non-card rows, or rows explicitly tagged general.
    return message.role !== "inline_card";
  }
  const kinds = SOURCE_TO_KINDS[source];
  return message.card_kind !== null && kinds.includes(message.card_kind);
}

// ── Searchable text extraction ──────────────────────────────────────────────────────────

/** Pulls every human-readable string out of a card payload for substring search. */
export function payloadSearchText(payload: unknown): string {
  if (payload === null || payload === undefined) return "";
  const parts: string[] = [];
  const visit = (val: unknown): void => {
    if (typeof val === "string") {
      parts.push(val);
    } else if (Array.isArray(val)) {
      val.forEach(visit);
    } else if (val && typeof val === "object") {
      Object.values(val as Record<string, unknown>).forEach(visit);
    }
  };
  visit(payload);
  return parts.join(" ");
}

/** The full searchable corpus for one message: its content + any card payload strings. */
export function messageSearchText(message: ChatMessage): string {
  return `${message.content} ${payloadSearchText(message.card_payload)}`.trim();
}

// ── Highlighting ────────────────────────────────────────────────────────────────────────

export type MatchRange = { start: number; end: number };

/**
 * Case-insensitive substring match ranges within a piece of text. Returns [] for an empty
 * query. Used by the UI to highlight matches in place.
 */
export function findMatches(text: string, query: string): MatchRange[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const haystack = text.toLowerCase();
  const ranges: MatchRange[] = [];
  let from = 0;
  for (;;) {
    const idx = haystack.indexOf(q, from);
    if (idx === -1) break;
    ranges.push({ start: idx, end: idx + q.length });
    from = idx + q.length;
  }
  return ranges;
}

// ── Combined query ──────────────────────────────────────────────────────────────────────

export type SearchQuery = {
  /** Substring across content + card payload. Empty = match all. */
  text?: string;
  /** Inclusive ISO lower bound on created_at. */
  from?: string;
  /** Inclusive ISO upper bound on created_at. */
  to?: string;
  source?: SearchSource;
};

/** A message that satisfied the query, with the ranges that matched its searchable text. */
export type SearchResult = {
  message: ChatMessage;
  matches: MatchRange[];
};

/**
 * Filters + (when a text query is present) annotates messages. Date bounds compare on the
 * raw ISO strings (lexicographically sortable for ISO-8601). A text query both filters
 * (must contain at least one match) and returns the match ranges for highlighting.
 */
export function searchMessages(
  messages: readonly ChatMessage[],
  query: SearchQuery,
): SearchResult[] {
  const source = query.source ?? "all";
  const text = query.text?.trim() ?? "";
  const out: SearchResult[] = [];

  for (const message of messages) {
    if (!matchesSource(message, source)) continue;
    if (query.from && message.created_at < query.from) continue;
    if (query.to && message.created_at > query.to) continue;

    if (text) {
      const matches = findMatches(messageSearchText(message), text);
      if (matches.length === 0) continue;
      out.push({ message, matches });
    } else {
      out.push({ message, matches: [] });
    }
  }
  return out;
}

// ── Export ──────────────────────────────────────────────────────────────────────────────

/** Pretty-printed JSON export of the given messages. */
export function exportToJson(messages: readonly ChatMessage[]): string {
  return JSON.stringify(messages, null, 2);
}

function cardHeading(kind: CardKind): string {
  return kind
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Human-readable Markdown export of the given messages. */
export function exportToMarkdown(messages: readonly ChatMessage[]): string {
  const lines: string[] = ["# Pocket Agent — chat history", ""];
  for (const m of messages) {
    const stamp = m.created_at;
    if (m.role === "inline_card" && m.card_kind) {
      lines.push(`### 🗂 ${cardHeading(m.card_kind)} — ${stamp}`);
      const payloadText = payloadSearchText(m.card_payload);
      if (m.content) lines.push("", m.content);
      if (payloadText) lines.push("", `> ${payloadText}`);
    } else {
      const who = m.role === "user" ? "You" : m.role === "assistant" ? "Pocket Agent" : "System";
      lines.push(`### ${who} — ${stamp}`);
      if (m.content) lines.push("", m.content);
    }
    lines.push("");
  }
  return lines.join("\n");
}
