// rate-limit.ts — in-memory fixed-window rate limit for the master-keyed workspace endpoint.
// 100 requests / minute per master key. In-process is enough for the MVP: issuance is a
// low-volume signup-time call, and a per-instance cap still bounds abuse from any single key.
// (If the endpoint ever needs a global cap across instances, swap this for the shared store.)

const LIMIT = 100;
const WINDOW_MS = 60_000;

export type RateWindow = { count: number; resetAt: number };

export type RateDecision = { ok: true } | { ok: false; retryAfterSeconds: number };

/** Drop windows that have already reset so the map doesn't grow unbounded. */
export function pruneExpired(store: Map<string, RateWindow>, now: number): void {
  for (const [key, win] of store) {
    if (win.resetAt <= now) store.delete(key);
  }
}

/** Record a hit for `masterKeyId` and decide whether it is within the 100/min window. */
export function hitRateLimit(
  store: Map<string, RateWindow>,
  masterKeyId: string,
  now: number,
): RateDecision {
  const win = store.get(masterKeyId);
  if (!win || win.resetAt <= now) {
    store.set(masterKeyId, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true };
  }
  if (win.count >= LIMIT) {
    return { ok: false, retryAfterSeconds: Math.ceil((win.resetAt - now) / 1000) };
  }
  win.count += 1;
  return { ok: true };
}
