// lib/launch-funnel/countdown.ts — pure helpers for the offer-page "LIMITED-TIME OFFER" timer.
// The deadline is a single absolute timestamp persisted in localStorage so a refresh or a back
// nav resumes the same countdown instead of resetting it. All time math is pure (now/deadline
// passed in) so it's unit-tested without timers or a DOM.

export const COUNTDOWN_TOTAL_SECONDS = 15 * 60; // 15:00 from session start
export const COUNTDOWN_STORAGE_KEY = "pa_launch_funnel_deadline";

/** Absolute deadline (ms epoch) for a session that started at `startMs`. */
export function deadlineFromStart(
  startMs: number,
  totalSeconds: number = COUNTDOWN_TOTAL_SECONDS,
): number {
  return startMs + totalSeconds * 1000;
}

/**
 * Resolve the deadline to display. A previously-stored deadline is honored (so the timer survives
 * refresh — even at 00:00). A missing, non-numeric, non-positive, or implausibly-far-future
 * (corrupt) value resets to `now + total`.
 */
export function resolveDeadline(
  stored: string | null | undefined,
  nowMs: number,
  totalSeconds: number = COUNTDOWN_TOTAL_SECONDS,
): number {
  if (typeof stored === "string" && stored.length > 0) {
    const parsed = Number.parseInt(stored, 10);
    const maxPlausible = nowMs + totalSeconds * 1000;
    if (Number.isFinite(parsed) && parsed > 0 && parsed <= maxPlausible) {
      return parsed;
    }
  }
  return deadlineFromStart(nowMs, totalSeconds);
}

/** Whole seconds remaining until the deadline, clamped at 0. */
export function remainingSeconds(deadlineMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil((deadlineMs - nowMs) / 1000));
}

/** Format whole seconds as MM:SS (e.g. 900 → "15:00", 5 → "00:05"). */
export function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return `${mm}:${ss}`;
}
