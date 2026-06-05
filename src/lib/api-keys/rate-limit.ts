// rate-limit.ts — per-API-key request limiting for the Public REST API. Limits are
// enforced as sliding-window counts over pa_api_requests_log (serverless has no shared
// in-memory token-bucket state, so the request log IS the bucket — one durable counter
// per key that every region reads consistently). Two windows per key: an hourly burst
// cap and a daily cap, both from SPEC §9.2.
//
// The pure `evaluateRateLimit` decision function is split from the DB-backed
// `checkRateLimit` so the window logic is unit-tested in isolation.

import { countRequestsSince } from "./db";

export const API_TIERS = ["free", "sync", "publish", "enterprise"] as const;
export type ApiTier = (typeof API_TIERS)[number];

export function isApiTier(value: string): value is ApiTier {
  return (API_TIERS as readonly string[]).includes(value);
}

export type RateLimits = {
  // null = unlimited (enterprise / fair use).
  perHour: number | null;
  perDay: number | null;
};

// Daily caps are fixed per SPEC §9.2. Hourly burst caps come from env (defaults match
// the spec) so they can be tuned without a redeploy.
const DAY_LIMITS: Record<ApiTier, number | null> = {
  free: 1000,
  sync: 10_000,
  publish: 100_000,
  enterprise: null,
};

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function getApiTierLimits(tier: ApiTier): RateLimits {
  const perDay = DAY_LIMITS[tier];
  const perHour =
    tier === "enterprise"
      ? null
      : tier === "free"
        ? envInt("PA_API_RATE_LIMIT_FREE_RPM", 100)
        : tier === "sync"
          ? envInt("PA_API_RATE_LIMIT_SYNC_RPM", 500)
          : envInt("PA_API_RATE_LIMIT_PUBLISH_RPM", 2000);
  return { perHour, perDay };
}

/**
 * Maps subscription status to an API tier. The dev Sync/Publish tiers ship in Wave 3
 * with their own Stripe lines, so until then everyone is `free`. `PA_API_DEFAULT_TIER`
 * lets an operator promote a key during testing before the price→tier mapping lands.
 */
export function apiTierFromSubscription(
  _status: string | null,
  envOverride: string | null,
): ApiTier {
  if (envOverride && isApiTier(envOverride)) return envOverride;
  return "free";
}

export type RateDecision = {
  allowed: boolean;
  // Which window tripped, when blocked.
  window: "hour" | "day" | null;
  limit: number | null;
  remaining: number;
  retryAfterSec: number;
};

/**
 * Pure decision: given the current hour + day request counts and the tier limits,
 * decides whether one more request is allowed. The hour window trips first when both
 * are exceeded (shorter retry). `remaining` reflects the binding (smallest-headroom)
 * window.
 */
export function evaluateRateLimit(args: {
  hourCount: number;
  dayCount: number;
  limits: RateLimits;
}): RateDecision {
  const { hourCount, dayCount, limits } = args;

  const hourOver = limits.perHour !== null && hourCount >= limits.perHour;
  const dayOver = limits.perDay !== null && dayCount >= limits.perDay;

  if (hourOver) {
    return { allowed: false, window: "hour", limit: limits.perHour, remaining: 0, retryAfterSec: 3600 };
  }
  if (dayOver) {
    return { allowed: false, window: "day", limit: limits.perDay, remaining: 0, retryAfterSec: 86_400 };
  }

  const hourRemaining = limits.perHour === null ? Infinity : limits.perHour - hourCount;
  const dayRemaining = limits.perDay === null ? Infinity : limits.perDay - dayCount;
  const remaining = Math.min(hourRemaining, dayRemaining);
  return {
    allowed: true,
    window: null,
    limit: limits.perDay,
    remaining: Number.isFinite(remaining) ? remaining : Number.MAX_SAFE_INTEGER,
    retryAfterSec: 0,
  };
}

/** DB-backed check for one key. Reads the trailing hour + day counts and decides. */
export async function checkRateLimit(
  apiKeyId: string,
  tier: ApiTier,
  deps: { countSince: typeof countRequestsSince } = { countSince: countRequestsSince },
): Promise<RateDecision> {
  const limits = getApiTierLimits(tier);
  // Unlimited tier → skip the DB round-trips entirely.
  if (limits.perHour === null && limits.perDay === null) {
    return { allowed: true, window: null, limit: null, remaining: Number.MAX_SAFE_INTEGER, retryAfterSec: 0 };
  }
  const now = Date.now();
  const hourAgo = new Date(now - 3600_000).toISOString();
  const dayAgo = new Date(now - 86_400_000).toISOString();
  const [hourCount, dayCount] = await Promise.all([
    deps.countSince(apiKeyId, hourAgo),
    deps.countSince(apiKeyId, dayAgo),
  ]);
  return evaluateRateLimit({ hourCount, dayCount, limits });
}
