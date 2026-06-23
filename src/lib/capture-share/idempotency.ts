// idempotency.ts — dedup for the PWA Web Share Target (PC-CORE-1).
//
// The share sheet can re-fire the same POST (a double-tap, a flaky network retry). We derive a
// deterministic key from (owner + the shared content + the timestamp bucketed to 5 seconds) so two
// identical shares inside the same 5-second window collapse to the same key, and a short-lived
// in-memory cache turns the second hit into a no-op.
//
// NOTE: the cache is per-process (no new tables in this lane — drift rule §8). That covers the real
// case this guards — a rapid double-fire hitting the same warm Function instance. The key itself is
// pure and fully testable; only the cache carries process state.

import { createHash } from "crypto";

/** Width of the timestamp bucket. Two identical shares within this window share one key. */
export const BUCKET_SECONDS = 5;

/** How long a seen key is remembered. ≥ the bucket so a key can't be re-accepted within its window. */
const CACHE_TTL_MS = 10_000;

export type IdempotencyInput = {
  ownerId: string;
  title?: string;
  text?: string;
  url?: string;
  /** Wall-clock time of the request in ms (injected so the key is deterministic in tests). */
  nowMs: number;
};

/** Floor a millisecond timestamp to its BUCKET_SECONDS-wide bucket index. */
export function bucketTimestamp(nowMs: number, bucketSeconds: number = BUCKET_SECONDS): number {
  return Math.floor(nowMs / (bucketSeconds * 1000));
}

/**
 * Derive the dedup key for a share. Identical (owner, title, text, url) shares that land in the same
 * 5-second bucket produce the same key; anything different — owner, any field, or a later bucket —
 * produces a different key.
 */
export function computeIdempotencyKey(input: IdempotencyInput): string {
  const bucket = bucketTimestamp(input.nowMs);
  const parts = [
    input.ownerId,
    input.title ?? "",
    input.text ?? "",
    input.url ?? "",
    String(bucket),
  ];
  return createHash("sha256").update(parts.join("\n")).digest("hex");
}

// ─── In-memory recent-key cache ───────────────────────────────────────────────────
// Map of key → expiry timestamp (ms). Pruned lazily on each call so it can't grow unbounded.

const seen = new Map<string, number>();

function prune(nowMs: number): void {
  for (const [key, expiresAt] of seen) {
    if (expiresAt <= nowMs) seen.delete(key);
  }
}

/**
 * Record a key and report whether it was already seen within its TTL. Returns true when this key is
 * a DUPLICATE (the caller should no-op), false when it is fresh (the caller should proceed). A fresh
 * key is recorded with a TTL so an immediate re-fire is caught.
 */
export function markAndCheckDuplicate(
  key: string,
  nowMs: number,
  ttlMs: number = CACHE_TTL_MS,
): boolean {
  prune(nowMs);
  const existing = seen.get(key);
  if (existing !== undefined && existing > nowMs) {
    return true;
  }
  seen.set(key, nowMs + ttlMs);
  return false;
}

/** Test-only: clear the recent-key cache so cases don't bleed into one another. */
export function __resetIdempotencyCacheForTests(): void {
  seen.clear();
}
