/**
 * Slack Web API client for the Slack Connection — direct fetch, no @slack/web-api SDK.
 * Mirrors lib/gmail.ts: every response is validated with Zod at the boundary and every
 * call returns a discriminated SlackResult instead of throwing.
 *
 * Two concerns live here:
 *   • OAuth token endpoints (oauth.v2.access — code exchange + refresh-token rotation).
 *   • slackApiCall<T> — the authenticated Web API caller every action uses, with
 *     hard-rate-limit (HTTP 429) backoff honoring Slack's Retry-After header.
 *
 * Slack quirk: the Web API answers HTTP 200 with `{ ok: false, error }` on logical
 * failures (e.g. channel_not_found, not_in_channel). parseSlackBody treats ok:false as
 * an error so callers never silently act on a non-success body.
 *
 * Token model: a workspace install yields a long-lived bot token (xoxb-…). When the app
 * has token rotation enabled, oauth.v2.access also returns a refresh_token + expires_in;
 * lib/connectors/slack/oauth.ts handles both. This module is transport only.
 */
import { z } from "zod";

export type SlackResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string; authError: boolean };

// invalid_auth / token_revoked / account_inactive (and HTTP 401) mean the stored token is
// dead — the caller flips the connection to status='error' and fires the re-auth flow rather
// than retrying. token rotation expiry (token_expired) is recoverable via refresh, so it is
// NOT treated as a hard auth failure here.
const HARD_AUTH_ERRORS = new Set(["invalid_auth", "token_revoked", "account_inactive", "not_authed"]);

function isAuthFailure(status: number, slackError: string | null): boolean {
  if (status === 401) return true;
  return slackError !== null && HARD_AUTH_ERRORS.has(slackError);
}

// ─── OAuth redirect_uri (single source of truth) ───────────────────────────────
// Slack rejects the token exchange with bad_redirect_uri unless the redirect_uri on the
// authorize request and the token exchange are a bit-exact match for a Redirect URL
// registered on the Slack app. Both routes call slackRedirectUri() so the value is identical.
// NEVER derive this from the request host — prod also answers on the `app.` subdomain + *.vercel.app
// aliases, none of which are registered.
const DEFAULT_OAUTH_REDIRECT_BASE = "https://aipocketagent.com";

export function slackRedirectUri(): string {
  const base = (process.env.PA_OAUTH_REDIRECT_BASE ?? DEFAULT_OAUTH_REDIRECT_BASE).replace(
    /\/+$/,
    "",
  );
  return `${base}/api/connections/slack/callback`;
}

// ─── Credentials ────────────────────────────────────────────────────────────────
export function slackOAuthCreds(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

/**
 * The app's Signing Secret (Slack Basic Information → Signing Secret). Every inbound Events API
 * request is HMAC-signed with it; the webhook verifies the signature before trusting a payload.
 * Null when unset so the webhook can refuse cleanly (501) instead of accepting unverifiable events.
 */
export function slackSigningSecret(): string | null {
  return process.env.SLACK_SIGNING_SECRET ?? null;
}

// ─── oauth.v2.access (code exchange + refresh) ──────────────────────────────────

// Bot install response. authed_user carries the installing user's id; team carries the
// workspace. refresh_token + expires_in are present only when token rotation is enabled.
const OAuthAccessSchema = z.object({
  ok: z.literal(true),
  access_token: z.string().min(1),
  token_type: z.string().optional(),
  scope: z.string().optional(),
  bot_user_id: z.string().optional(),
  refresh_token: z.string().optional(),
  expires_in: z.number().int().positive().optional(),
  team: z.object({ id: z.string(), name: z.string().optional() }).optional(),
  authed_user: z.object({ id: z.string() }).optional(),
});
export type SlackOAuthAccess = z.infer<typeof OAuthAccessSchema>;

async function postOAuthAccess(
  params: Record<string, string>,
): Promise<SlackResult<SlackOAuthAccess>> {
  const res = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
    cache: "no-store",
  });

  const text = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, error: text.slice(0, 300), authError: res.status === 401 };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, status: 502, error: "oauth.v2.access returned non-JSON", authError: false };
  }

  // Logical failure: ok:false with an error code.
  const errored = raw as { ok?: boolean; error?: string };
  if (errored.ok === false) {
    const slackError = typeof errored.error === "string" ? errored.error : "unknown_error";
    return { ok: false, status: 400, error: slackError, authError: isAuthFailure(400, slackError) };
  }

  const parsed = OAuthAccessSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, status: 502, error: "oauth.v2.access shape invalid", authError: false };
  }
  return { ok: true, data: parsed.data };
}

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
): Promise<SlackResult<SlackOAuthAccess>> {
  const creds = slackOAuthCreds();
  if (!creds) return { ok: false, status: 500, error: "oauth_not_configured", authError: false };
  return postOAuthAccess({
    code,
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    redirect_uri: redirectUri,
  });
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<SlackResult<SlackOAuthAccess>> {
  const creds = slackOAuthCreds();
  if (!creds) return { ok: false, status: 500, error: "oauth_not_configured", authError: false };
  return postOAuthAccess({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
  });
}

/** Revoke a token at Slack (auth.revoke). Best-effort: a failure is non-fatal. */
export async function revokeToken(token: string): Promise<void> {
  try {
    await fetch("https://slack.com/api/auth.revoke", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/x-www-form-urlencoded" },
      cache: "no-store",
    });
  } catch {
    // Revocation is best-effort; the row is wiped regardless of the network outcome.
  }
}

// ─── Authenticated Web API caller (with 429 backoff) ────────────────────────────

// Cap on hard-rate-limit retries before giving up, and the ceiling on a single honored
// Retry-After sleep (Slack can ask for long waits; a Vercel function can't block forever).
const MAX_RATE_LIMIT_RETRIES = 3;
const MAX_RETRY_AFTER_MS = 5_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(header: string | null): number {
  const secs = header ? Number.parseInt(header, 10) : NaN;
  if (!Number.isFinite(secs) || secs <= 0) return 1_000;
  return Math.min(secs * 1_000, MAX_RETRY_AFTER_MS);
}

/**
 * Call a Slack Web API method (POST JSON) with a bot/user token and validate the response
 * body against `schema`. Honors HTTP 429 with bounded Retry-After backoff. Returns a typed
 * error (never throws) for transport failures, ok:false bodies, and shape mismatches.
 */
export async function slackApiCall<T>(
  token: string,
  method: string,
  body: Record<string, unknown>,
  schema: z.ZodType<T>,
): Promise<SlackResult<T>> {
  let attempt = 0;
  // Retry loop: only HTTP 429 retries; every other outcome returns immediately.
  for (;;) {
    const res = await fetch(`https://slack.com/api/${method}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (res.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
      attempt += 1;
      await sleep(parseRetryAfterMs(res.headers.get("retry-after")));
      continue;
    }

    const text = await res.text();
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: res.status === 429 ? "rate_limited" : text.slice(0, 300),
        authError: res.status === 401,
      };
    }

    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return { ok: false, status: 502, error: `${method} returned non-JSON`, authError: false };
    }

    const errored = raw as { ok?: boolean; error?: string };
    if (errored.ok === false) {
      const slackError = typeof errored.error === "string" ? errored.error : "unknown_error";
      return { ok: false, status: 400, error: slackError, authError: isAuthFailure(400, slackError) };
    }

    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, status: 502, error: `${method} response shape invalid`, authError: false };
    }
    return { ok: true, data: parsed.data };
  }
}
