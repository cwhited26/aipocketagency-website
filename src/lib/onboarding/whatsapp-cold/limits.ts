// limits.ts — the §22.4 per-sender rate limits, pure and unit-testable. The handler evaluates
// BEFORE any model call, so a rate-limited or paused sender costs zero tokens and (past the
// one notice each) zero Meta conversation charges.

import {
  MAX_THREAD_STARTS_PER_24H,
  MAX_UNMIGRATED_TURNS,
  RATE_WINDOW_MS,
  TRIAL_TTL_MS,
  type TrialThreadRow,
} from "./types";

export type RateDecision =
  // Proceed; for a fresh/restarted thread the handler applies the window bookkeeping patch.
  | { allowed: true; restart: boolean; startsInWindow: number; windowStartedAt: string }
  // Reply once with the given notice kind, then stop.
  | { allowed: false; reason: "cooloff" | "window_exhausted" | "turn_cap"; notify: boolean }
  // Hard silence — no outbound at all (already past the cap notice, or a converted row).
  | { allowed: false; reason: "silent"; notify: false };

/** True when the thread is stale past the 14-day TTL (a new message restarts it). */
export function isExpiredByTtl(thread: TrialThreadRow, now: Date): boolean {
  return now.getTime() - new Date(thread.last_active_at).getTime() > TRIAL_TTL_MS;
}

/**
 * Evaluates one inbound against the thread's rate state. `thread` null = first-ever contact.
 * Converted threads bypass the turn cap (the §22.1 step-8 "thread continues" mode) but still
 * honor a post-cancel cool-off.
 */
export function evaluateRateLimit(thread: TrialThreadRow | null, now: Date): RateDecision {
  const nowIso = now.toISOString();

  if (thread === null) {
    return { allowed: true, restart: true, startsInWindow: 1, windowStartedAt: nowIso };
  }

  // §22.4 cool-off: a converted-then-canceled owner waits 7 days before a fresh trial.
  if (thread.cooloff_until && new Date(thread.cooloff_until).getTime() > now.getTime()) {
    // One notice per thread start is enough; the declined status marks that it went out.
    return { allowed: false, reason: "cooloff", notify: thread.status !== "declined" };
  }

  if (thread.status === "converted") {
    // Post-conversion the thread keeps working — the cap exists to bound UNMIGRATED spend.
    return {
      allowed: true,
      restart: false,
      startsInWindow: thread.starts_in_window,
      windowStartedAt: thread.window_started_at,
    };
  }

  const restarting = thread.status === "expired" || isExpiredByTtl(thread, now);
  if (restarting) {
    const windowFresh =
      now.getTime() - new Date(thread.window_started_at).getTime() < RATE_WINDOW_MS;
    const starts = windowFresh ? thread.starts_in_window + 1 : 1;
    if (starts > MAX_THREAD_STARTS_PER_24H) {
      return { allowed: false, reason: "window_exhausted", notify: thread.status !== "declined" };
    }
    return {
      allowed: true,
      restart: true,
      startsInWindow: starts,
      windowStartedAt: windowFresh ? thread.window_started_at : nowIso,
    };
  }

  if (thread.status === "paused") {
    // The cap notice already went out when the thread flipped to paused. Hard silence.
    return { allowed: false, reason: "silent", notify: false };
  }

  if (thread.status === "declined") {
    // A previously-declined sender gets another look (the decline was per-message, not a ban) —
    // but no restart bookkeeping; the thread continues.
    return {
      allowed: true,
      restart: false,
      startsInWindow: thread.starts_in_window,
      windowStartedAt: thread.window_started_at,
    };
  }

  // §22.4 Meta cost cap: this turn would exceed the unmigrated budget → one notice, then pause.
  if (thread.turn_count >= MAX_UNMIGRATED_TURNS) {
    return { allowed: false, reason: "turn_cap", notify: true };
  }

  return {
    allowed: true,
    restart: false,
    startsInWindow: thread.starts_in_window,
    windowStartedAt: thread.window_started_at,
  };
}
