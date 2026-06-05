// context.ts — the shared entry harness for every Public REST API v1 route. Owns
// Bearer-key auth, per-key rate limiting, CORS, request logging, and error shaping so
// each route handler stays a thin, typed function. Wrap a handler with `handleV1`.

import { NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-keys/keys";
import {
  apiTierFromSubscription,
  checkRateLimit,
  type ApiTier,
  type RateDecision,
} from "@/lib/api-keys/rate-limit";
import { logApiRequest, type ApiKeyRow } from "@/lib/api-keys/db";
import { fetchPaUser, type PaUser } from "@/lib/pa-supabase";

export const API_BADGE = "Powered by Pocket Agent"; // free-tier, non-removable (SPEC §5)

export type V1Context = {
  userId: string;
  apiKey: ApiKeyRow;
  tier: ApiTier;
  rate: RateDecision;
  // The owner's brain context — null when no brain repo is connected yet.
  paUser: PaUser | null;
};

export type V1HandlerResult = {
  response: Response;
  // Tokens attributable to this request (LLM calls). Defaults to 0.
  tokensUsed?: number;
  // Streaming endpoints log their own usage on stream completion.
  skipLog?: boolean;
};

export type V1Handler = (req: Request, ctx: V1Context) => Promise<V1HandlerResult>;

// ── CORS ────────────────────────────────────────────────────────────────────────────

/**
 * GET endpoints are public-CORS (`*`). POST endpoints are restricted to the per-key
 * origin allowlist carried in `scopes`. Non-browser clients send no Origin and are
 * unaffected either way.
 */
export function resolveCorsOrigin(
  method: string,
  requestOrigin: string | null,
  scopes: string[],
): string | null {
  if (method === "GET" || method === "HEAD") return "*";
  // Mutating methods: only echo an Origin that the key explicitly allowlisted.
  if (requestOrigin && scopes.includes(requestOrigin)) return requestOrigin;
  return null;
}

function corsHeaders(origin: string | null): Record<string, string> {
  const h: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (origin) h["Access-Control-Allow-Origin"] = origin;
  return h;
}

/** CORS preflight. Always allow the probe; the real request enforces the key + scopes. */
export function handlePreflight(req: Request): Response {
  const origin = req.headers.get("origin");
  return new Response(null, {
    status: 204,
    headers: corsHeaders(origin ?? "*"),
  });
}

function rateHeaders(rate: RateDecision): Record<string, string> {
  const h: Record<string, string> = {
    "X-RateLimit-Limit": rate.limit === null ? "unlimited" : String(rate.limit),
    "X-RateLimit-Remaining": String(rate.remaining),
  };
  if (!rate.allowed) h["Retry-After"] = String(rate.retryAfterSec);
  return h;
}

function jsonError(
  status: number,
  error: string,
  extraHeaders: Record<string, string> = {},
): Response {
  return NextResponse.json(
    { error },
    { status, headers: { ...extraHeaders, "X-Powered-By": API_BADGE } },
  );
}

// ── Main wrapper ──────────────────────────────────────────────────────────────────────

export async function handleV1(req: Request, handler: V1Handler): Promise<Response> {
  const method = req.method;
  const requestOrigin = req.headers.get("origin");

  if (method === "OPTIONS") return handlePreflight(req);

  // 1. Authenticate.
  const auth = await validateApiKey(req.headers.get("authorization"));
  if (!auth.ok) {
    const corsOrigin = resolveCorsOrigin(method, requestOrigin, []);
    return jsonError(401, `Invalid API key (${auth.reason}).`, corsHeaders(corsOrigin));
  }

  const corsOrigin = resolveCorsOrigin(method, requestOrigin, auth.key.scopes);
  const cors = corsHeaders(corsOrigin);

  // 2. Tier + rate limit (per key).
  const tier = apiTierFromSubscription(null, process.env.PA_API_DEFAULT_TIER ?? null);
  let rate: RateDecision;
  try {
    rate = await checkRateLimit(auth.key.id, tier);
  } catch {
    // A rate-store failure must not hard-fail the API — fail open with a permissive
    // decision (the request is still logged below for visibility).
    rate = { allowed: true, window: null, limit: null, remaining: Number.MAX_SAFE_INTEGER, retryAfterSec: 0 };
  }

  const endpoint = new URL(req.url).pathname;

  if (!rate.allowed) {
    await logApiRequest({
      api_key_id: auth.key.id,
      endpoint,
      method,
      status_code: 429,
      tokens_used: 0,
    }).catch(() => undefined);
    return jsonError(
      429,
      `Rate limit exceeded for the ${rate.window} window. Retry after ${rate.retryAfterSec}s.`,
      { ...cors, ...rateHeaders(rate) },
    );
  }

  // 3. Resolve brain context (best-effort; some endpoints don't need it).
  let paUser: PaUser | null = null;
  try {
    const res = await fetchPaUser(auth.key.user_id);
    paUser = res.ok ? res.data : null;
  } catch {
    paUser = null;
  }

  const ctx: V1Context = { userId: auth.key.user_id, apiKey: auth.key, tier, rate, paUser };

  // 4. Run the handler, log, and decorate the response.
  let result: V1HandlerResult;
  try {
    result = await handler(req, ctx);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    await logApiRequest({
      api_key_id: auth.key.id,
      endpoint,
      method,
      status_code: 500,
      tokens_used: 0,
    }).catch(() => undefined);
    return jsonError(500, message, { ...cors, ...rateHeaders(rate) });
  }

  if (!result.skipLog) {
    await logApiRequest({
      api_key_id: auth.key.id,
      endpoint,
      method,
      status_code: result.response.status,
      tokens_used: result.tokensUsed ?? 0,
    }).catch(() => undefined);
  }

  // Decorate the (possibly streaming) response with CORS + rate + badge headers.
  const headers = new Headers(result.response.headers);
  for (const [k, v] of Object.entries({ ...cors, ...rateHeaders(rate), "X-Powered-By": API_BADGE })) {
    headers.set(k, v);
  }
  return new Response(result.response.body, {
    status: result.response.status,
    statusText: result.response.statusText,
    headers,
  });
}

/** Convenience JSON responder for handlers (badge + status). */
export function v1Json(data: unknown, status = 200): Response {
  return NextResponse.json(data, { status });
}
