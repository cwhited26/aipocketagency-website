// connectors/zoom/format.ts — pure helpers shared by the action schemas, dry-run summaries, and
// the cross-connector composer. No network, no DB — unit-testable in isolation.

/**
 * Minutes between two ISO-8601 instants, rounded to the nearest minute, clamped to [1, 1440].
 * Returns null when either bound is unparseable or the end is not after the start — the caller
 * then falls back to an explicit `duration` (never guesses a meeting length silently).
 */
export function durationMinutes(startIso: string, endIso: string): number | null {
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  const mins = Math.round((end - start) / 60_000);
  if (mins <= 0) return null;
  return Math.min(mins, 1_440);
}

/**
 * Normalize a meeting id that a model may pass as a number or a string (Zoom meeting ids are
 * long numerics) into the string the REST path wants. Returns null for empty/garbage.
 */
export function meetingIdToPath(id: unknown): string | null {
  if (typeof id === "number" && Number.isFinite(id)) return String(Math.trunc(id));
  if (typeof id === "string" && id.trim()) return id.trim();
  return null;
}

/** Append a "Join Zoom: <url>" line to an event/email description without duplicating it. */
export function withZoomLine(description: string | undefined, joinUrl: string): string {
  const base = (description ?? "").trimEnd();
  if (base.includes(joinUrl)) return base; // already present — don't double up
  const line = `Join Zoom: ${joinUrl}`;
  return base ? `${base}\n\n${line}` : line;
}

/** "Fri, Jun 12, 3:00 PM" style label is overkill here — keep the raw ISO for determinism. */
export function whenLabel(startIso: string | undefined): string {
  return startIso && startIso.trim() ? startIso.trim() : "—";
}
