// dashboard.ts — pure helpers behind the rich Captures dashboard (PC-CORE-6).
//
// Captures live in the owner's brain at memory/inbox.md (the shared Capture Inbox write path used by
// every surface). The server page reads + parses that file into InboxEntry[] and maps each to a
// DashboardCapture here; the client then searches / tag-filters / paginates entirely in-memory (the
// whole feed is already loaded, so no per-keystroke server roundtrip). Every function in this module
// is pure → unit-tested, so the dashboard's search, filtering, pagination, tag ranking, relative-time
// formatting, and gating contract are all exercised without driving React.
//
// Builds on feed.ts's primitives (iconForSource, previewOf) rather than re-deriving them.

import { z } from "zod";
import type { InboxEntry } from "@/lib/pa-inbox";
import { previewOf } from "./feed";

// ─── Normalized capture source ─────────────────────────────────────────────────
// Every capture surface (typed API, email forward, SMS, share sheet, voice, plus any file under
// inbox/) is folded into one of these. The unified feed reads every surface, so a single normalized
// source drives the filter chips and the per-row badge regardless of where the capture physically
// lives (a memory/inbox.md block or its own .md file).
export const CaptureSourceSchema = z.enum([
  "inbox-md",
  "voice-memo",
  "email-forward",
  "sms",
  "shared",
  "typed",
  "other",
]);
export type CaptureSource = z.infer<typeof CaptureSourceSchema>;

/**
 * The normalized CaptureItem the unified feed produces — one shape for every surface, validated at
 * the read boundary (see captures-source.ts). `raw.path` points at the backing file (memory/inbox.md
 * for blocks, the memo's own file for file-backed captures); `lineRange` is reserved for block spans.
 */
export const CaptureItemSchema = z.object({
  id: z.string().min(1),
  source: CaptureSourceSchema,
  capturedAt: z.date(),
  body: z.string(),
  tags: z.array(z.string()),
  routedTo: z.string().optional(),
  deletedAt: z.date().optional(),
  raw: z.object({
    path: z.string().min(1),
    lineRange: z.tuple([z.number(), z.number()]).optional(),
  }),
});
export type CaptureItem = z.infer<typeof CaptureItemSchema>;

// The capture-source strings stamped by each endpoint, grouped to a normalized CaptureSource. A
// memory/inbox.md block carries one of these in its `source` meta; file-backed captures are detected
// by kind/path before this map is consulted.
const SOURCE_ALIASES: Record<string, CaptureSource> = {
  email_forward: "email-forward",
  sms: "sms",
  share_sheet: "shared",
  ios_share: "shared",
  voice: "voice-memo",
  voice_shortcut: "voice-memo",
  ios_shortcut: "voice-memo",
  typed: "typed",
  text: "typed",
};

/**
 * Normalize a parsed inbox entry to a CaptureSource. Voice files (kind "voice") and anything stamped
 * with a voice-ish source map to "voice-memo"; a block with no source meta is the legacy typed/API
 * capture path → "inbox-md"; an unrecognized source → "other". Pure → unit-tested.
 */
export function classifyCaptureSource(entry: Pick<InboxEntry, "kind" | "source">): CaptureSource {
  if (entry.kind === "voice") return "voice-memo";
  const source = entry.source?.trim();
  if (!source) return "inbox-md";
  return SOURCE_ALIASES[source] ?? "other";
}

// Per-source display icon (the app uses emoji glyphs, not an icon font). Drives the row badge.
const SOURCE_ICONS: Record<CaptureSource, string> = {
  "inbox-md": "📝",
  typed: "📝",
  "voice-memo": "🎙️",
  "email-forward": "📧",
  sms: "📲",
  shared: "🔗",
  other: "📥",
};

/** Emoji badge for a normalized capture source. Pure. */
export function iconForCaptureSource(source: CaptureSource): string {
  return SOURCE_ICONS[source];
}

const SOURCE_LABELS: Record<CaptureSource, string> = {
  "inbox-md": "Typed",
  typed: "Typed",
  "voice-memo": "Voice",
  "email-forward": "Email",
  sms: "SMS",
  shared: "Shared",
  other: "Capture",
};

/** Short human label for a normalized capture source (drives the per-row badge). Pure. */
export function labelForCaptureSource(source: CaptureSource): string {
  return SOURCE_LABELS[source];
}

// ─── Source filter chips ───────────────────────────────────────────────────────
// The chip row at the top of the feed. "all" is the default; each other chip collapses one or more
// normalized sources (typed folds both the legacy inbox-md blocks and explicitly-typed captures).
export type SourceChip = "all" | "voice" | "email" | "sms" | "shared" | "typed";

export const SOURCE_CHIPS: ReadonlyArray<{ key: SourceChip; label: string; icon: string }> = [
  { key: "all", label: "All", icon: "📥" },
  { key: "typed", label: "Typed", icon: "📝" },
  { key: "voice", label: "Voice", icon: "🎙️" },
  { key: "email", label: "Email", icon: "📧" },
  { key: "sms", label: "SMS", icon: "📲" },
  { key: "shared", label: "Shared", icon: "🔗" },
];

const CHIP_OF_SOURCE: Record<CaptureSource, Exclude<SourceChip, "all"> | "other"> = {
  "inbox-md": "typed",
  typed: "typed",
  "voice-memo": "voice",
  "email-forward": "email",
  sms: "sms",
  shared: "shared",
  other: "other",
};

/** True when a capture's normalized source belongs under the given chip ("all" matches everything). */
export function captureMatchesChip(source: CaptureSource, chip: SourceChip): boolean {
  if (chip === "all") return true;
  return CHIP_OF_SOURCE[source] === chip;
}

// ─── Stable capture ids ─────────────────────────────────────────────────────────
// A memory/inbox.md block keeps its UUID. A file-backed capture's id is its repo path, but a path
// contains slashes that would break a single [id] route segment, so we encode it as
// `file:<base64url(path)>` — slash-free, URL-safe, and reversible. Isomorphic (TextEncoder/btoa exist
// in both Node and the browser) so the same helpers run on the server (encode) and in the route (decode).
const FILE_ID_PREFIX = "file:";

function base64url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(padded);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** The public, route-safe id for a capture: the block UUID, or `file:<encoded path>` for a file. Pure. */
export function encodeCaptureId(entry: InboxEntry): string {
  return entry.path ? `${FILE_ID_PREFIX}${base64url(entry.path)}` : entry.id;
}

/** Decode a `file:`-prefixed capture id back to its repo path, or null for a plain block id. Pure. */
export function decodeFileCaptureId(id: string): string | null {
  if (!id.startsWith(FILE_ID_PREFIX)) return null;
  try {
    const path = fromBase64url(id.slice(FILE_ID_PREFIX.length));
    return path.length > 0 ? path : null;
  } catch {
    return null;
  }
}

/** One capture row as the dashboard needs it: full content for the expand view, tags, tombstone. */
export type DashboardCapture = {
  id: string;
  ts: string;
  source: string | null;
  /** Normalized source driving the filter chips and the row badge. */
  sourceType: CaptureSource;
  icon: string;
  title: string | null;
  content: string;
  /** One-line preview for the collapsed row. */
  preview: string;
  tags: string[];
  /** Optional http(s) audio URL for a voice capture; drives the card's <audio> player when present. */
  audioUrl?: string;
  /** Soft-deleted entries are kept in the brain file but hidden from the feed. */
  deleted: boolean;
};

/** Map a parsed inbox entry to a dashboard row. Pure. */
export function toDashboardCapture(entry: InboxEntry): DashboardCapture {
  const sourceType = classifyCaptureSource(entry);
  return {
    id: encodeCaptureId(entry),
    ts: entry.ts,
    source: entry.source ?? null,
    sourceType,
    icon: iconForCaptureSource(sourceType),
    title: entry.title ?? null,
    content: entry.content,
    preview: previewOf(entry.title ? `${entry.title} — ${entry.content}` : entry.content),
    tags: entry.tags ?? [],
    ...(entry.audioUrl ? { audioUrl: entry.audioUrl } : {}),
    deleted: Boolean(entry.deletedAt),
  };
}

/** Normalize a parsed inbox entry to a validated CaptureItem (the unified-feed boundary shape). Pure. */
export function toCaptureItem(entry: InboxEntry): CaptureItem {
  return CaptureItemSchema.parse({
    id: encodeCaptureId(entry),
    source: classifyCaptureSource(entry),
    capturedAt: new Date(entry.ts),
    body: entry.content,
    tags: entry.tags ?? [],
    ...(entry.deletedAt ? { deletedAt: new Date(entry.deletedAt) } : {}),
    raw: { path: entry.path ?? CAPTURE_INBOX_RAW_PATH },
  });
}

// The shared inbox file path, duplicated here (rather than importing from feed.ts) so toCaptureItem
// stays a pure leaf with no extra coupling; feed.ts re-exports the same constant for the route.
const CAPTURE_INBOX_RAW_PATH = "memory/inbox.md";

export type CaptureFilter = {
  /** Free-text substring (case-insensitive) matched against title + content + tags. */
  query: string;
  /** Tags that must ALL be present (AND), combined with the query. */
  tags: string[];
  /** Source chip — defaults to "all" when omitted, AND-combined with query + tags. */
  source?: SourceChip;
};

/**
 * The captures that pass the source chip AND the search box AND the selected tag pills. Soft-deleted
 * rows are always excluded. Matching is case-insensitive; every dimension is AND-combined.
 */
export function filterCaptures(list: DashboardCapture[], filter: CaptureFilter): DashboardCapture[] {
  const q = filter.query.trim().toLowerCase();
  const wanted = filter.tags.map((t) => t.toLowerCase()).filter((t) => t.length > 0);
  const chip = filter.source ?? "all";

  return list.filter((c) => {
    if (c.deleted) return false;
    if (!captureMatchesChip(c.sourceType, chip)) return false;
    if (wanted.length > 0) {
      const have = new Set(c.tags.map((t) => t.toLowerCase()));
      if (!wanted.every((t) => have.has(t))) return false;
    }
    if (q) {
      const haystack = [c.title ?? "", c.content, c.tags.join(" ")].join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

export type TagCount = { tag: string; count: number };

/**
 * The `n` most-used tags across the (non-deleted) captures, by frequency desc then alphabetical.
 * Drives the filter pills. Case-insensitive counting; the first-seen spelling is kept for display.
 */
export function topTags(list: DashboardCapture[], n: number): TagCount[] {
  const counts = new Map<string, TagCount>();
  for (const c of list) {
    if (c.deleted) continue;
    for (const t of c.tags) {
      const key = t.toLowerCase();
      const existing = counts.get(key);
      if (existing) existing.count += 1;
      else counts.set(key, { tag: t, count: 1 });
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, Math.max(0, n));
}

/**
 * Cumulative pagination for infinite scroll: returns every item through `page` (1-based), i.e. the
 * first `page * perPage`. "Load more" bumps `page`, revealing the next slice without dropping the
 * ones already shown. Pure → unit-tested.
 */
export function paginate<T>(list: T[], page: number, perPage: number): T[] {
  if (perPage <= 0) return [];
  const safePage = Math.max(1, Math.floor(page));
  return list.slice(0, safePage * perPage);
}

/** True when there are more items beyond the current page (drives the scroll sentinel). */
export function hasMore(total: number, page: number, perPage: number): boolean {
  if (perPage <= 0) return false;
  return Math.max(1, Math.floor(page)) * perPage < total;
}

/**
 * Human relative time ("just now", "3 min ago", "5 h ago", "2 d ago", else an absolute date) for a
 * capture timestamp, given the current epoch ms. Pure (no hidden Date.now()) so the client can pass a
 * stable server-rendered `now` for the first paint and a live clock thereafter — no hydration drift.
 */
export function formatRelativeTime(iso: string, nowMs: number): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const diff = nowMs - t;
  if (diff < 45_000) return "just now";
  const sec = Math.floor(diff / 1000);
  if (sec < 90) return "1 min ago";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} d ago`;
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

type Debounced<A extends unknown[]> = ((...args: A) => void) & { cancel: () => void };

/**
 * Trailing-edge debounce: the wrapped call fires `ms` after the last invocation. The search box uses
 * this to apply the in-memory filter only once the user pauses typing (200ms). Pure timing logic →
 * unit-tested with fake timers; `cancel()` clears a pending call (used on unmount).
 */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): Debounced<A> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const debounced = ((...args: A) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, ms);
  }) as Debounced<A>;
  debounced.cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
  return debounced;
}

/** Which view the /app/captures server page should resolve to, given the caller's state. */
export type CapturesView = "login" | "onboarding" | "no-brain" | "show";

/**
 * Pure gating contract for the dashboard (mirrors PC-MARK-3's decideOnboardingRoute style so the
 * redirect/empty-state behavior is unit-tested without a live request):
 *   - no signed-in user                          → "login"      (→ /app/login?next=/app/captures)
 *   - a Pocket Capture buyer who hasn't onboarded → "onboarding" (→ the PC-MARK-3 wizard)
 *   - no brain repo connected yet                → "no-brain"   (empty state with a connect CTA)
 *   - otherwise                                  → "show"       (render the feed)
 * The dashboard is open to ALL logged-in PA users (no buyer gate) — only the wizard redirect is
 * buyer-specific, matching PC-MARK-3.
 */
export function decideCapturesView(state: {
  hasUser: boolean;
  hasBrain: boolean;
  isPocketCaptureBuyer: boolean;
  onboardingDone: boolean;
}): CapturesView {
  if (!state.hasUser) return "login";
  if (state.isPocketCaptureBuyer && !state.onboardingDone) return "onboarding";
  if (!state.hasBrain) return "no-brain";
  return "show";
}
