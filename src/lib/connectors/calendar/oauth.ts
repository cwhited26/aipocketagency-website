// connectors/calendar/oauth.ts — the shared Google OAuth refresh + scope check for the
// Calendar connector (Connections Roadmap §2.2, §3.1).
//
// Calendar reuses the SAME Google OAuth client as Gmail (GMAIL_OAUTH_CLIENT_ID /
// GMAIL_OAUTH_CLIENT_SECRET) — "adding scopes to the same client" — but stores its grant in
// its own pa_connections row (provider='calendar') so it connects/disconnects independently.
// Incremental authorization: a Gmail-only user re-grants Google to add the calendar scope the
// first time they connect Calendar (the start route sends include_granted_scopes=true).
//
// Direct REST only — no googleapis SDK. The token-exchange/refresh/revoke logic is implemented
// here rather than imported from lib/gmail.ts so the connector folder is self-contained.

import { z } from "zod";
import { decrypt } from "@/lib/crypto/encrypt";
import {
  updateCalendarAccessToken,
  markCalendarConnectionError,
  type CalendarConnectionFull,
} from "@/lib/pa-calendar-connections";
import { sendEmail } from "@/lib/resend";

// ─── Scopes ───────────────────────────────────────────────────────────────────
// calendar.events grants read + write on the user's own events (create/update/cancel +
// invite attendees). openid + email identify the account for the connection card.
export const CALENDAR_EVENTS_SCOPE = "https://www.googleapis.com/auth/calendar.events";

export const CALENDAR_SCOPES = ["openid", "email", CALENDAR_EVENTS_SCOPE];

/** True iff a connection's granted scopes include calendar.events (read + write). */
export function hasCalendarScope(scopes: readonly string[] | null): boolean {
  return Array.isArray(scopes) && scopes.includes(CALENDAR_EVENTS_SCOPE);
}

export type CalendarResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string; authError: boolean };

/** Thrown when a refresh fails because the Google grant is dead — caller flips to reauth. */
export class ReauthNeededError extends Error {
  constructor(message = "Google Calendar authorization expired") {
    super(message);
    this.name = "ReauthNeededError";
  }
}

// ─── OAuth redirect_uri (single source of truth) ───────────────────────────────
// Bit-exact match required between the auth request (start route) and the token exchange
// (callback route), and it must be an Authorized redirect URI on the GCP OAuth client.
// Derived from PA_OAUTH_REDIRECT_BASE (the same env the Gmail flow uses), never the host.
const DEFAULT_OAUTH_REDIRECT_BASE = "https://aipocketagent.com";

export function calendarRedirectUri(): string {
  const base = (process.env.PA_OAUTH_REDIRECT_BASE ?? DEFAULT_OAUTH_REDIRECT_BASE).replace(
    /\/+$/,
    "",
  );
  return `${base}/api/connections/calendar/callback`;
}

// 401, 403, or an invalid_grant body means the refresh token is dead.
function isAuthFailure(status: number, body: string): boolean {
  return status === 401 || status === 403 || body.includes("invalid_grant");
}

function oauthCreds(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.GMAIL_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GMAIL_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

// ─── Token endpoints ──────────────────────────────────────────────────────────

const TokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().optional(),
  expires_in: z.number().int().positive(),
  scope: z.string().optional(),
  token_type: z.string().optional(),
});
export type CalendarTokenResponse = z.infer<typeof TokenResponseSchema>;

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
): Promise<CalendarResult<CalendarTokenResponse>> {
  const creds = oauthCreds();
  if (!creds) return { ok: false, status: 500, error: "oauth_not_configured", authError: false };

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }).toString(),
    cache: "no-store",
  });
  return parseTokenResponse(res);
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<CalendarResult<CalendarTokenResponse>> {
  const creds = oauthCreds();
  if (!creds) return { ok: false, status: 500, error: "oauth_not_configured", authError: false };

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      grant_type: "refresh_token",
    }).toString(),
    cache: "no-store",
  });
  return parseTokenResponse(res);
}

async function parseTokenResponse(
  res: Response,
): Promise<CalendarResult<CalendarTokenResponse>> {
  const text = await res.text();
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: text,
      authError: isAuthFailure(res.status, text),
    };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, status: 502, error: "token endpoint returned non-JSON", authError: false };
  }
  const parsed = TokenResponseSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, status: 502, error: "token response shape invalid", authError: false };
  }
  return { ok: true, data: parsed.data };
}

/** Revoke a refresh/access token at Google. Best-effort: a failure is non-fatal. */
export async function revokeToken(token: string): Promise<void> {
  try {
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }).toString(),
      cache: "no-store",
    });
  } catch {
    // Revocation is best-effort; the row is wiped regardless.
  }
}

// ─── Account email (OpenID userinfo) ───────────────────────────────────────────
// Uses the openid/email scope rather than a Gmail endpoint, so it works for a
// Calendar-only grant (a user who never connected Gmail).

const UserInfoSchema = z.object({ email: z.string().optional() });

export async function fetchGoogleAccountEmail(accessToken: string): Promise<string | null> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const raw: unknown = await res.json().catch(() => null);
  const parsed = UserInfoSchema.safeParse(raw);
  return parsed.success ? parsed.data.email ?? null : null;
}

// ─── Fresh access token (refresh + persist when expired) ───────────────────────

/**
 * Return a valid access token for a Calendar connection, refreshing + persisting it when the
 * cached one is missing or within 60s of expiry. On a hard refresh failure the connection is
 * flipped to status='error', a re-auth notice is sent (Resend), and a ReauthNeededError-class
 * failure is returned (authError:true) so the caller can surface the reconnect path.
 */
export async function ensureFreshCalendarAccessToken(
  conn: CalendarConnectionFull,
  notifyEmail: string | null,
): Promise<CalendarResult<string>> {
  const now = Date.now();
  const expiresAt = conn.access_token_expires_at
    ? new Date(conn.access_token_expires_at).getTime()
    : 0;
  if (conn.access_token && expiresAt - 60_000 > now) {
    return { ok: true, data: conn.access_token };
  }

  if (!conn.refresh_token_encrypted) {
    await markCalendarConnectionError(conn.id);
    await sendCalendarReauthEmail(notifyEmail);
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
      await markCalendarConnectionError(conn.id);
      await sendCalendarReauthEmail(notifyEmail);
    }
    return refreshed;
  }

  const newExpiry = new Date(now + refreshed.data.expires_in * 1000).toISOString();
  await updateCalendarAccessToken(conn.id, refreshed.data.access_token, newExpiry);
  return { ok: true, data: refreshed.data.access_token };
}

// ─── Re-auth system email (Resend) ─────────────────────────────────────────────
// Connections Roadmap §3.5: on a dead Calendar grant, send a one-tap reconnect notice.
// The Resend transport shipped (lib/resend.ts). Sending is best-effort — a transport
// failure never masks the underlying auth error the caller already returns.

const REAUTH_FROM = "Pocket Agent <notifications@aipocketagency.com>";
const RECONNECT_URL = "https://aipocketagent.com/app/settings/connections";

async function sendCalendarReauthEmail(toEmail: string | null): Promise<void> {
  if (!toEmail) return;
  await sendEmail({
    from: REAUTH_FROM,
    to: toEmail,
    subject: "Reconnect Google Calendar — Pocket Agent",
    text:
      "Your Google Calendar connection needs to be reconnected before Pocket Agent can " +
      `schedule or update events for you again.\n\nReconnect: ${RECONNECT_URL}\n`,
    html:
      `<p>Your Google Calendar connection needs to be reconnected before Pocket Agent can ` +
      `schedule or update events for you again.</p>` +
      `<p><a href="${RECONNECT_URL}">Reconnect Google Calendar →</a></p>`,
  });
}
