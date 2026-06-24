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

import type { InboxEntry } from "@/lib/pa-inbox";
import { iconForSource, previewOf } from "./feed";

/** One capture row as the dashboard needs it: full content for the expand view, tags, tombstone. */
export type DashboardCapture = {
  id: string;
  ts: string;
  source: string | null;
  icon: string;
  title: string | null;
  content: string;
  /** One-line preview for the collapsed row. */
  preview: string;
  tags: string[];
  /** Soft-deleted entries are kept in the brain file but hidden from the feed. */
  deleted: boolean;
};

/** Map a parsed inbox entry to a dashboard row. Pure. */
export function toDashboardCapture(entry: InboxEntry): DashboardCapture {
  return {
    id: entry.id,
    ts: entry.ts,
    source: entry.source ?? null,
    icon: iconForSource(entry.source),
    title: entry.title ?? null,
    content: entry.content,
    preview: previewOf(entry.title ? `${entry.title} — ${entry.content}` : entry.content),
    tags: entry.tags ?? [],
    deleted: Boolean(entry.deletedAt),
  };
}

export type CaptureFilter = {
  /** Free-text substring (case-insensitive) matched against title + content + tags. */
  query: string;
  /** Tags that must ALL be present (AND), combined with the query. */
  tags: string[];
};

/**
 * The captures that pass the search box AND the selected tag pills. Soft-deleted rows are always
 * excluded. Matching is case-insensitive; tag selection is AND-combined with the substring query.
 */
export function filterCaptures(list: DashboardCapture[], filter: CaptureFilter): DashboardCapture[] {
  const q = filter.query.trim().toLowerCase();
  const wanted = filter.tags.map((t) => t.toLowerCase()).filter((t) => t.length > 0);

  return list.filter((c) => {
    if (c.deleted) return false;
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
