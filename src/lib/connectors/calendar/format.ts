// connectors/calendar/format.ts — pure formatting helpers shared by the action dry-run
// summaries and audit lines. No network, no DB — unit-testable in isolation.

import type { EventDateTime } from "./api";

/**
 * Build a Calendar EventDateTime from an ISO string. A bare date (YYYY-MM-DD) becomes an
 * all-day `date`; anything with a time component becomes a timed `dateTime`. `timeZone` is
 * attached to timed events so the API anchors them correctly.
 */
export function toEventDateTime(iso: string, timeZone: string | undefined): EventDateTime {
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso.trim());
  if (isDateOnly) return { date: iso.trim() };
  const dt: EventDateTime = { dateTime: iso };
  if (timeZone) dt.timeZone = timeZone;
  return dt;
}

/** Human label for an EventDateTime point — the dateTime, the date, or "—" when absent. */
export function whenLabel(dt: EventDateTime | undefined): string {
  if (!dt) return "—";
  return dt.dateTime ?? dt.date ?? "—";
}

/** "a, b and c" — Oxford-free join for short human lists. */
export function humanList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
