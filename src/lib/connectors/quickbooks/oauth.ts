// connectors/quickbooks/oauth.ts — the Intuit OAuth 2.0 flow + token lifecycle for the
// QuickBooks Online connector (Connections Roadmap §2.3, §3.5).
//
// Its OWN Intuit Developer app (INTUIT_CLIENT_ID / INTUIT_CLIENT_SECRET) — unlike Calendar,
// QuickBooks doesn't share a Google client. INTUIT_ENVIRONMENT selects the production vs
// sandbox API host. The grant lives in its own pa_connections row (provider='quickbooks').
//
// Direct REST only — no intuit-oauth SDK. The token-exchange/refresh/revoke logic is
// implemented here so the connector folder is self-contained.
//
// Re-auth (roadmap §2.3): Intuit refresh tokens rotate every ~100 days and die after ~101 days
// of disuse. On a hard refresh failure the connection flips to status='error' and a HIGH-
// PRIORITY system email fires (a dead QuickBooks connection blocks revenue actions).

import { decrypt, encrypt } from "@/lib/crypto/encrypt";
import { sendEmail } from "@/lib/resend";
import {
  markQuickBooksConnectionError,
  updateQuickBooksAccessToken,
  updateQuickBooksRefreshToken,
  type QuickBooksConnectionFull,
} from "@/lib/pa-quickbooks-connections";
import type { QuickBooksResult } from "./types";

// ─── Scopes ───────────────────────────────────────────────────────────────────
// A single scope governs read + write on the accounting domain; least-privilege is enforced at
// the ACTION layer (gates + the trust ladder), not the scope (roadmap §2.3). openid + email
// would let us read the account identity, but the company name comes from the CompanyInfo API
// (post-connect), so accounting alone is the minimal grant.
export const QUICKBOOKS_ACCOUNTING_SCOPE = "com.intuit.quickbooks.accounting";
export const QUICKBOOKS_SCOPES = [QUICKBOOKS_ACCOUNTING_SCOPE];

/** True iff a connection's granted scopes include the accounting scope (read + write). */
export function hasAccountingScope(scopes: readonly string[] | null): boolean {
  return Array.isArray(scopes) && scopes.includes(QUICKBOOKS_ACCOUNTING_SCOPE);
}

// ─── Endpoints ──────────────────────────────────────────────────────────────────
const AUTHORIZE_URL = "https://appcenter.intuit.com/connect/oauth2";
const TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const REVOKE_URL = "https://developer.api.intuit.com/v2/oauth2/tokens/revoke";

const PRODUCTION_API_BASE = "https://quickbooks.api.intuit.com";
const SANDBOX_API_BASE = "https://sandbox-quickbooks.api.intuit.com";

/** The QBO API host for the configured environment (sandbox unless INTUIT_ENVIRONMENT=production). */
export function quickBooksApiBase(): string {
  return (process.env.INTUIT_ENVIRONMENT ?? "sandbox").toLowerCase() === "production"
    ? PRODUCTION_API_BASE
    : SANDBOX_API_BASE;
}

// ─── OAuth credentials + config check ─────────────────────────────────────────
export function quickBooksOAuthCreds(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.INTUIT_CLIENT_ID;
  const clientSecret = process.env.INTUIT_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

/** True iff Intuit OAuth is configured in this deployment (client id + secret on Vercel). */
export function isQuickBooksOAuthConfigured(): boolean {
  return quickBooksOAuthCreds() !== null;
}

// ─── OAuth redirect_uri (single source of truth) ───────────────────────────────
// Bit-exact match required between the auth request (start route) and the token exchange
// (callback route), and it must be a Redirect URI on the Intuit app. Derived from
// PA_OAUTH_REDIRECT_BASE (the same env every connector uses), never the host.
const DEFAULT_OAUTH_REDIRECT_BASE = "https://app.aipocketagency.com";

export function quickBooksRedirectUri(): string {
  const base = (process.env.PA_OAUTH_REDIRECT_BASE ?? DEFAULT_OAUTH_REDIRECT_BASE).replace(
    /\/+$/,
    "",
  );
  return `${base}/api/connections/quickbooks/callback`;
}

/** Build the Intuit authorize URL. `state` is the signed CSRF token. */
export function buildQuickBooksAuthorizeUrl(clientId: string, state: string): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", QUICKBOOKS_SCOPES.join(" "));
  url.searchParams.set("redirect_uri", quickBooksRedirectUri());
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
  x_refresh_token_expires_in?: unknown;
  token_type?: unknown;
};

export type QuickBooksTokenResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

function parseTokenShape(raw: RawTokenResponse): QuickBooksTokenResponse | null {
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
  };
}

async function postToken(
  form: Record<string, string>,
): Promise<QuickBooksResult<QuickBooksTokenResponse>> {
  const creds = quickBooksOAuthCreds();
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
): Promise<QuickBooksResult<QuickBooksTokenResponse>> {
  return postToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<QuickBooksResult<QuickBooksTokenResponse>> {
  return postToken({ grant_type: "refresh_token", refresh_token: refreshToken });
}

/** Revoke a refresh/access token at Intuit. Best-effort: a failure is non-fatal. */
export async function revokeToken(token: string): Promise<void> {
  const creds = quickBooksOAuthCreds();
  if (!creds) return;
  try {
    await fetch(REVOKE_URL, {
      method: "POST",
      headers: {
        Authorization: basicAuthHeader(creds.clientId, creds.clientSecret),
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token }),
      cache: "no-store",
    });
  } catch {
    // Revocation is best-effort; the row is wiped regardless.
  }
}

// ─── Company name (CompanyInfo API) ─────────────────────────────────────────────
// Fetched once post-connect for the Connections card. A failure is non-fatal — the card
// falls back to "Connected company".

export async function fetchCompanyName(
  accessToken: string,
  realmId: string,
): Promise<string | null> {
  const url = `${quickBooksApiBase()}/v3/company/${encodeURIComponent(realmId)}/companyinfo/${encodeURIComponent(realmId)}?minorversion=70`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const raw: unknown = await res.json().catch(() => null);
  if (raw === null || typeof raw !== "object") return null;
  const info = (raw as { CompanyInfo?: { CompanyName?: unknown } }).CompanyInfo;
  return info && typeof info.CompanyName === "string" ? info.CompanyName : null;
}

// ─── Fresh access token (refresh + persist when expired) ───────────────────────

/**
 * Return a valid access token for a QuickBooks connection, refreshing + persisting it when the
 * cached one is missing or within 60s of expiry. Intuit always returns a fresh refresh token on
 * each refresh, so the rotated refresh token is persisted too. On a hard refresh failure the
 * connection flips to status='error', the high-priority re-auth notice fires, and an
 * authError:true result is returned so the caller surfaces the reconnect path.
 */
export async function ensureFreshQuickBooksToken(
  conn: QuickBooksConnectionFull,
  notifyEmail: string | null,
): Promise<QuickBooksResult<string>> {
  const now = Date.now();
  const expiresAt = conn.access_token_expires_at
    ? new Date(conn.access_token_expires_at).getTime()
    : 0;
  if (conn.access_token && expiresAt - 60_000 > now) {
    return { ok: true, data: conn.access_token };
  }

  if (!conn.refresh_token_encrypted) {
    await markQuickBooksConnectionError(conn.id);
    await sendQuickBooksReauthEmail(notifyEmail);
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
      await markQuickBooksConnectionError(conn.id);
      await sendQuickBooksReauthEmail(notifyEmail);
    }
    return refreshed;
  }

  const newExpiry = new Date(now + refreshed.data.expiresIn * 1000).toISOString();
  await updateQuickBooksAccessToken(conn.id, refreshed.data.accessToken, newExpiry);
  // Intuit rotates the refresh token on every refresh — persist it or the next refresh fails.
  if (refreshed.data.refreshToken !== refreshToken) {
    await updateQuickBooksRefreshToken(conn.id, encrypt(refreshed.data.refreshToken));
  }
  return { ok: true, data: refreshed.data.accessToken };
}

// ─── Re-auth system email (roadmap §2.3 — HIGH PRIORITY) ────────────────────────
// A dead QuickBooks connection blocks invoicing + payments, so the nudge is flagged urgent.
// Best-effort: a transport failure (e.g. RESEND_API_KEY unset) never masks the auth error the
// caller already returns.

const REAUTH_FROM = "Pocket Agent <agent@aipocketagency.com>";

async function sendQuickBooksReauthEmail(toEmail: string | null): Promise<void> {
  if (!toEmail) return;
  const reconnectUrl = `${(process.env.PA_OAUTH_REDIRECT_BASE ?? DEFAULT_OAUTH_REDIRECT_BASE).replace(/\/+$/, "")}/app/settings/connections`;
  await sendEmail({
    from: REAUTH_FROM,
    to: toEmail,
    subject: "Action needed: reconnect QuickBooks — invoicing is paused",
    text:
      "Your QuickBooks connection expired, so Pocket Agent can't create invoices or record " +
      `payments until you reconnect it.\n\nReconnect: ${reconnectUrl}\n\n` +
      "Until then, every QuickBooks action stays paused.",
    html:
      `<p>Your QuickBooks connection expired, so Pocket Agent can't create invoices or record ` +
      `payments until you reconnect it.</p>` +
      `<p><a href="${reconnectUrl}">Reconnect QuickBooks →</a></p>` +
      `<p>Until then, every QuickBooks action stays paused.</p>`,
  });
}
