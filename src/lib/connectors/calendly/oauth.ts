// connectors/calendly/oauth.ts — the Calendly OAuth 2.0 flow + token lifecycle for the Calendly
// connector (Connections Roadmap §3.1, §3.5).
//
// Its OWN Calendly Developer app (CALENDLY_CLIENT_ID / CALENDLY_CLIENT_SECRET) — unlike Calendar,
// Calendly doesn't share Google's client. Standard authorization-code flow per Calendly's docs.
// The grant lives in its own pa_connections row (provider='calendly') with the connected user's
// resource URI in the calendly_user_uri column (every Calendly API call is scoped to it).
//
// Direct REST only — no Calendly SDK. The token-exchange/refresh/revoke logic is implemented here
// so the connector folder is self-contained.
//
// Scopes (task item 2): Calendly's standard OAuth grant covers the reads + writes this connector
// needs (event types, scheduled events, scheduling links) without granular scope strings or
// incremental-authorization gymnastics. Calendly's token response doesn't echo a scope set, so we
// record a single synthetic marker ("calendly.default") to signal "the grant is present" — the
// real least-privilege boundary is the action layer (gates + the trust ladder), not the scope.
//
// Re-auth (roadmap §3.5): on a hard refresh failure the connection flips to status='error' and a
// system email fires (Resend) so the owner can reconnect before a booking link goes stale.

import { decrypt, encrypt } from "@/lib/crypto/encrypt";
import { sendEmail } from "@/lib/resend";
import {
  markCalendlyConnectionError,
  updateCalendlyAccessToken,
  updateCalendlyRefreshToken,
  type CalendlyConnectionFull,
} from "@/lib/pa-calendly-connections";
import type { CalendlyResult } from "./types";

// ─── Scopes ───────────────────────────────────────────────────────────────────
// Calendly's standard grant is full-access for the connected user; there is no scope param on the
// authorize URL. We persist this marker so the rest of the codebase has a uniform "has scope"
// check, mirroring how QuickBooks records its single requested scope.
export const CALENDLY_DEFAULT_SCOPE = "calendly.default";
export const CALENDLY_SCOPES = [CALENDLY_DEFAULT_SCOPE];

/** True iff a connection records the Calendly grant marker (present after a successful connect). */
export function hasCalendlyScope(scopes: readonly string[] | null): boolean {
  return Array.isArray(scopes) && scopes.includes(CALENDLY_DEFAULT_SCOPE);
}

// ─── Endpoints ──────────────────────────────────────────────────────────────────
const AUTHORIZE_URL = "https://auth.calendly.com/oauth/authorize";
const TOKEN_URL = "https://auth.calendly.com/oauth/token";

// ─── OAuth credentials + config check ─────────────────────────────────────────
export function calendlyOAuthCreds(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.CALENDLY_CLIENT_ID;
  const clientSecret = process.env.CALENDLY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

/** True iff Calendly OAuth is configured in this deployment (client id + secret on Vercel). */
export function isCalendlyOAuthConfigured(): boolean {
  return calendlyOAuthCreds() !== null;
}

// ─── OAuth redirect_uri (single source of truth) ───────────────────────────────
// Bit-exact match required between the auth request (start route) and the token exchange
// (callback route), and it must be a Redirect URI registered on the Calendly app. Derived from
// PA_OAUTH_REDIRECT_BASE (the same env every connector uses), never the request host.
const DEFAULT_OAUTH_REDIRECT_BASE = "https://aipocketagent.com";

export function calendlyRedirectBase(): string {
  return (process.env.PA_OAUTH_REDIRECT_BASE ?? DEFAULT_OAUTH_REDIRECT_BASE).replace(/\/+$/, "");
}

export function calendlyRedirectUri(): string {
  return `${calendlyRedirectBase()}/api/connections/calendly/callback`;
}

/** Build the Calendly authorize URL. `state` is the signed CSRF token. */
export function buildCalendlyAuthorizeUrl(clientId: string, state: string): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", calendlyRedirectUri());
  url.searchParams.set("state", state);
  return url.toString();
}

// ─── Token endpoints (HTTP Basic auth: base64(client_id:client_secret)) ─────────

function basicAuthHeader(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

// 400 invalid_grant or a 401/403 means the refresh token is dead.
function isAuthFailure(status: number, body: string): boolean {
  return status === 401 || status === 403 || body.includes("invalid_grant");
}

type RawTokenResponse = {
  access_token?: unknown;
  refresh_token?: unknown;
  expires_in?: unknown;
  token_type?: unknown;
  // Calendly returns the connected user + organization resource URIs on the token response.
  owner?: unknown;
  organization?: unknown;
};

export type CalendlyTokenResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  // The connected user's resource URI (https://api.calendly.com/users/<uuid>) — stored on the
  // connection and threaded into every API call.
  ownerUri: string | null;
};

function parseTokenShape(raw: RawTokenResponse): CalendlyTokenResponse | null {
  if (
    typeof raw.access_token !== "string" ||
    typeof raw.refresh_token !== "string" ||
    typeof raw.expires_in !== "number"
  ) {
    return null;
  }
  return {
    accessToken: raw.access_token,
    refreshToken: raw.refresh_token,
    expiresIn: raw.expires_in,
    ownerUri: typeof raw.owner === "string" ? raw.owner : null,
  };
}

async function postToken(
  form: Record<string, string>,
): Promise<CalendlyResult<CalendlyTokenResponse>> {
  const creds = calendlyOAuthCreds();
  if (!creds) return { ok: false, status: 500, error: "oauth_not_configured", authError: false };

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(creds.clientId, creds.clientSecret),
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(form).toString(),
    cache: "no-store",
  });

  const text = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, error: text, authError: isAuthFailure(res.status, text) };
  }
  let raw: RawTokenResponse;
  try {
    raw = JSON.parse(text) as RawTokenResponse;
  } catch {
    return { ok: false, status: 502, error: "token endpoint returned non-JSON", authError: false };
  }
  const parsed = parseTokenShape(raw);
  if (!parsed) {
    return { ok: false, status: 502, error: "token response shape invalid", authError: false };
  }
  return { ok: true, data: parsed };
}

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
): Promise<CalendlyResult<CalendlyTokenResponse>> {
  return postToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<CalendlyResult<CalendlyTokenResponse>> {
  return postToken({ grant_type: "refresh_token", refresh_token: refreshToken });
}

/** Revoke a refresh/access token at Calendly. Best-effort: a failure is non-fatal. */
export async function revokeToken(token: string): Promise<void> {
  const creds = calendlyOAuthCreds();
  if (!creds) return;
  try {
    await fetch("https://auth.calendly.com/oauth/revoke", {
      method: "POST",
      headers: {
        Authorization: basicAuthHeader(creds.clientId, creds.clientSecret),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ token }).toString(),
      cache: "no-store",
    });
  } catch {
    // Revocation is best-effort; the row is wiped regardless.
  }
}

// ─── Current user (GET /users/me) ────────────────────────────────────────────────
// Fetched once at connect to record the user URI (the resource every call is scoped to) plus the
// email + name for the Connections card. A failure on the email/name is non-fatal — the URI from
// the token's `owner` field is the part that must be present.

export type CalendlyCurrentUser = {
  uri: string;
  email: string | null;
  name: string | null;
};

export async function fetchCurrentUser(
  accessToken: string,
): Promise<CalendlyResult<CalendlyCurrentUser>> {
  const res = await fetch("https://api.calendly.com/users/me", {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, error: text, authError: isAuthFailure(res.status, text) };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, status: 502, error: "users/me returned non-JSON", authError: false };
  }
  const resource = (raw as { resource?: { uri?: unknown; email?: unknown; name?: unknown } })
    .resource;
  if (!resource || typeof resource.uri !== "string") {
    return { ok: false, status: 502, error: "users/me response shape invalid", authError: false };
  }
  return {
    ok: true,
    data: {
      uri: resource.uri,
      email: typeof resource.email === "string" ? resource.email : null,
      name: typeof resource.name === "string" ? resource.name : null,
    },
  };
}

// ─── Fresh access token (refresh + persist when expired) ───────────────────────

/**
 * Return a valid access token for a Calendly connection, refreshing + persisting it when the
 * cached one is missing or within 60s of expiry. On a hard refresh failure the connection flips to
 * status='error', the re-auth notice fires, and an authError:true result is returned so the caller
 * surfaces the reconnect path. Calendly may rotate the refresh token on refresh, so a changed one
 * is persisted too (defensive — like QuickBooks).
 */
export async function ensureFreshCalendlyToken(
  conn: CalendlyConnectionFull,
  notifyEmail: string | null,
): Promise<CalendlyResult<string>> {
  const now = Date.now();
  const expiresAt = conn.access_token_expires_at
    ? new Date(conn.access_token_expires_at).getTime()
    : 0;
  if (conn.access_token && expiresAt - 60_000 > now) {
    return { ok: true, data: conn.access_token };
  }

  if (!conn.refresh_token_encrypted) {
    await markCalendlyConnectionError(conn.id);
    await sendCalendlyReauthEmail(notifyEmail);
    return { ok: false, status: 401, error: "no_refresh_token", authError: true };
  }

  let refreshToken: string;
  try {
    refreshToken = decrypt(conn.refresh_token_encrypted);
  } catch (err) {
    return {
      ok: false,
      status: 500,
      error: err instanceof Error ? err.message : "decrypt_failed",
      authError: false,
    };
  }

  const refreshed = await refreshAccessToken(refreshToken);
  if (!refreshed.ok) {
    if (refreshed.authError) {
      await markCalendlyConnectionError(conn.id);
      await sendCalendlyReauthEmail(notifyEmail);
    }
    return refreshed;
  }

  const newExpiry = new Date(now + refreshed.data.expiresIn * 1000).toISOString();
  await updateCalendlyAccessToken(conn.id, refreshed.data.accessToken, newExpiry);
  if (refreshed.data.refreshToken !== refreshToken) {
    await updateCalendlyRefreshToken(conn.id, encrypt(refreshed.data.refreshToken));
  }
  return { ok: true, data: refreshed.data.accessToken };
}

// ─── Re-auth system email (roadmap §3.5) ───────────────────────────────────────
// On a dead Calendly grant, send a one-tap reconnect notice. Best-effort: a transport failure
// (e.g. RESEND_API_KEY unset) never masks the auth error the caller already returns.

const REAUTH_FROM = "Pocket Agent <notifications@aipocketagency.com>";

async function sendCalendlyReauthEmail(toEmail: string | null): Promise<void> {
  if (!toEmail) return;
  const reconnectUrl = `${calendlyRedirectBase()}/app/settings/connections`;
  await sendEmail({
    from: REAUTH_FROM,
    to: toEmail,
    subject: "Reconnect Calendly — Pocket Agent",
    text:
      "Your Calendly connection needs to be reconnected before Pocket Agent can send booking " +
      `links or read what's on your schedule again.\n\nReconnect: ${reconnectUrl}\n`,
    html:
      `<p>Your Calendly connection needs to be reconnected before Pocket Agent can send booking ` +
      `links or read what's on your schedule again.</p>` +
      `<p><a href="${reconnectUrl}">Reconnect Calendly →</a></p>`,
  });
}
