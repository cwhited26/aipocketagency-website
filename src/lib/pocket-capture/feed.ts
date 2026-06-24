// feed.ts — the minimal capture-feed read used by the onboarding wizard's first-capture step
// (PC-MARK-3). The rich dashboard feed (search, tags, edit/delete, pagination) is PC-CORE-6's job;
// this lane only needs "what are the most recent N captures?" so Step 4 can poll until the first one
// lands. Captures live in the owner's brain at memory/inbox.md (the shared Capture Inbox write path
// used by every surface), so we read + parse that file rather than a dedicated table.

import type { InboxEntry } from "@/lib/pa-inbox";

const INBOX_PATH = "memory/inbox.md";
export const CAPTURE_INBOX_PATH = INBOX_PATH;

// Per-surface display icon. Sources are stamped by the capture endpoints: share_sheet (PC-CORE-1),
// email_forward (PC-CORE-2), sms (PC-CORE-3), ios_shortcut (PC-CORE-4). Unknown/absent → default.
const SOURCE_ICONS: Record<string, string> = {
  share_sheet: "🔗",
  ios_share: "🔗",
  email_forward: "✉️",
  sms: "📱",
  ios_shortcut: "🎤",
  voice: "🎤",
};

export type FeedItem = {
  id: string;
  ts: string;
  source: string | null;
  icon: string;
  title: string | null;
  /** A short, single-line preview of the capture body for the confirmation card. */
  preview: string;
};

/** Icon for a capture source (default 📝 when unknown/absent). Pure. */
export function iconForSource(source: string | null | undefined): string {
  if (!source) return "📝";
  return SOURCE_ICONS[source] ?? "📝";
}

/** Collapse a capture body to a one-line preview, clamped to `max` chars. Pure. */
export function previewOf(content: string, max = 140): string {
  const oneLine = content.replace(/\s+/g, " ").trim();
  return oneLine.length > max ? `${oneLine.slice(0, max - 1).trimEnd()}…` : oneLine;
}

/** Map a parsed inbox entry to a feed item. Pure. */
export function toFeedItem(entry: InboxEntry): FeedItem {
  return {
    id: entry.id,
    ts: entry.ts,
    source: entry.source ?? null,
    icon: iconForSource(entry.source),
    title: entry.title ?? null,
    preview: previewOf(entry.title ? `${entry.title} — ${entry.content}` : entry.content),
  };
}

/**
 * The most recent `limit` captures, newest first. `entries` is the output of parseInboxForDisplay
 * (already newest-first). Pure → unit-tested; the route supplies the parsed entries.
 */
export function recentFeedItems(entries: InboxEntry[], limit: number): FeedItem[] {
  return entries.slice(0, Math.max(0, limit)).map(toFeedItem);
}

/**
 * Whether the wizard's first-capture poll should stop: true once any capture has landed. The client
 * clears its polling interval the moment this returns true (PC-MARK-3, step 4). Pure → unit-tested so
 * the stop condition is verified without driving the React effect.
 */
export function shouldStopPolling(items: FeedItem[]): boolean {
  return items.length > 0;
}
