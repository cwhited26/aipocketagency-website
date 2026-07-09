// lib/ghl-waitlist/rate-limit.ts — per-IP fixed-window limiter for the public waitlist endpoint.
// In-process only (per serverless instance), which is the right size for "don't let one IP dump
// a thousand rows": a form abuser hammers one warm instance, and the window catches it. The
// window math is pure so the tests drive it with a fake clock.

export const WINDOW_MS = 10 * 60 * 1000;
export const MAX_PER_WINDOW = 5;

export type RateWindow = { windowStartMs: number; count: number };

export type RateVerdict = { ok: true } | { ok: false; retryAfterSeconds: number };

/**
 * Counts a hit for `ip` against a fixed window and says whether it's allowed. Mutates `store`
 * (the caller owns the Map's lifetime — module scope in the route, a fresh Map in tests).
 */
export function hitRateLimit(
  store: Map<string, RateWindow>,
  ip: string,
  nowMs: number,
): RateVerdict {
  const current = store.get(ip);
  if (!current || nowMs - current.windowStartMs >= WINDOW_MS) {
    store.set(ip, { windowStartMs: nowMs, count: 1 });
    return { ok: true };
  }
  current.count += 1;
  if (current.count > MAX_PER_WINDOW) {
    const retryAfterMs = current.windowStartMs + WINDOW_MS - nowMs;
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }
  return { ok: true };
}

/** Drops expired windows so the map doesn't grow unbounded on a long-lived instance. */
export function pruneExpired(store: Map<string, RateWindow>, nowMs: number): void {
  for (const [ip, win] of store) {
    if (nowMs - win.windowStartMs >= WINDOW_MS) store.delete(ip);
  }
}
