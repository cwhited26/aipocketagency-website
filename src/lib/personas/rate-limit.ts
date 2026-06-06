// rate-limit.ts — server-side request windowing for public + widget personas
// (SPEC v3 §9 Mode B; Adversarial Brief §3(g)). Three independent fixed-window counters,
// each enforced server-side via an atomic INSERT…ON CONFLICT increment RPC (migration
// 016) so token rotation, header spoofing, and concurrent requests cannot reset or race
// past a limit:
//   • per IP per hour       (PA_PERSONAS_RATE_LIMIT_IP_PER_HOUR,     default 60)
//   • per session per day   (PA_PERSONAS_RATE_LIMIT_SESSION_PER_DAY, default 100)
//   • per persona per day   (PA_PERSONAS_RATE_LIMIT_PERSONA_PER_DAY, default 5000)
//
// The window-bucket math + limit evaluation are pure and unit-tested
// (__tests__/rate-limit.test.ts); the DB increment lives behind hitRateLimit().

import { incrementRateLimit } from "./db";
import type { RateLimitScope } from "./types";

export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

/** Default limits if the env vars are unset (mirrors the SPEC defaults). */
export const DEFAULT_LIMITS = {
  ip_hour: 60,
  session_day: 100,
  persona_day: 5000,
} as const;

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Resolves the configured limit for an enforced scope. */
export function limitForScope(scope: Exclude<RateLimitScope, "blocked_hour">): number {
  switch (scope) {
    case "ip_hour":
      return envInt("PA_PERSONAS_RATE_LIMIT_IP_PER_HOUR", DEFAULT_LIMITS.ip_hour);
    case "session_day":
      return envInt("PA_PERSONAS_RATE_LIMIT_SESSION_PER_DAY", DEFAULT_LIMITS.session_day);
    case "persona_day":
      return envInt("PA_PERSONAS_RATE_LIMIT_PERSONA_PER_DAY", DEFAULT_LIMITS.persona_day);
  }
}

/**
 * Computes the start of the fixed window a timestamp falls into. Hour scopes bucket to
 * the top of the hour; day scopes to UTC midnight. Returned as an ISO string (the RPC's
 * window_start key) so the same wall-clock window always maps to the same row.
 */
export function windowStartIso(scope: RateLimitScope, now: Date = new Date()): string {
  const ms = now.getTime();
  if (scope === "ip_hour" || scope === "blocked_hour") {
    return new Date(Math.floor(ms / HOUR_MS) * HOUR_MS).toISOString();
  }
  return new Date(Math.floor(ms / DAY_MS) * DAY_MS).toISOString();
}

export type RateVerdict = { ok: true } | { ok: false; scope: RateLimitScope; retryAfter: string };

/**
 * Pure verdict: is `count` (the value AFTER this request's increment) within `limit`?
 * A request is allowed when its incremented count does not exceed the limit.
 */
export function evaluateRateLimit(
  count: number,
  limit: number,
  scope: RateLimitScope,
  retryAfter: string,
): RateVerdict {
  if (count <= limit) return { ok: true };
  return { ok: false, scope, retryAfter };
}

export type EnforceInput = {
  personaId: string;
  ip: string;
  sessionId: string;
  now?: Date;
};

/**
 * Enforces all three windows for one turn. Increments each counter atomically (so the
 * count reflects this request) and returns the first scope that is over its limit, if
 * any. The persona-day window is checked first so a single hot persona can't be DoS'd by
 * one IP exhausting it for everyone — but all three are always incremented.
 */
export async function enforceRateLimits(input: EnforceInput): Promise<RateVerdict> {
  const now = input.now ?? new Date();
  const checks: Array<{ scope: Exclude<RateLimitScope, "blocked_hour">; ip: string; session: string }> = [
    { scope: "persona_day", ip: "", session: "" },
    { scope: "ip_hour", ip: input.ip, session: "" },
    { scope: "session_day", ip: "", session: input.sessionId },
  ];

  let firstFailure: RateVerdict | null = null;
  for (const c of checks) {
    const windowStart = windowStartIso(c.scope, now);
    const count = await incrementRateLimit({
      personaId: input.personaId,
      scope: c.scope,
      ip: c.ip,
      sessionId: c.session,
      windowStart,
    });
    const verdict = evaluateRateLimit(count, limitForScope(c.scope), c.scope, retryAfterFor(c.scope, now));
    if (!verdict.ok && !firstFailure) firstFailure = verdict;
  }
  return firstFailure ?? { ok: true };
}

function retryAfterFor(scope: RateLimitScope, now: Date): string {
  const ms = now.getTime();
  if (scope === "ip_hour" || scope === "blocked_hour") {
    return new Date(Math.ceil((ms + 1) / HOUR_MS) * HOUR_MS).toISOString();
  }
  return new Date(Math.ceil((ms + 1) / DAY_MS) * DAY_MS).toISOString();
}

/**
 * Records one abuse-defense block for a persona and returns the running count this hour.
 * The caller alerts the owner when the count crosses the alert threshold exactly once.
 */
export async function recordBlockedHit(personaId: string, now: Date = new Date()): Promise<number> {
  return incrementRateLimit({
    personaId,
    scope: "blocked_hour",
    ip: "",
    sessionId: "",
    windowStart: windowStartIso("blocked_hour", now),
  });
}
