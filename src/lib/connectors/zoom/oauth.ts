// connectors/zoom/oauth.ts — the Zoom User-level OAuth flow + token lifecycle for the Connection
// (Connections Roadmap §3.1, §3.5 model).
//
// Zoom uses standard OAuth 2.0 authorization-code grant with User-level OAuth (each PA owner
// connects THEIR own Zoom account — NOT Server-to-Server, which would be one account for the whole
// platform). The token exchange + refresh authenticate with HTTP Basic auth (base64 of
// client_id:client_secret), which is how Zoom differs from Google (client creds in the body) and
// Stripe (platform key as client_secret). Scopes are configured on the Zoom app in the Marketplace
// and are NOT passed on the authorize URL — Zoom derives the grant from the app's configured scope
// set (this is why the scope syntax "differs from Google's": you declare it on the app, not the URL).
//
// Token model: short-lived access token (expires_in ~3600s) + a refresh token that Zoom ROTATES on
// every refresh — the response carries a fresh refresh_token that MUST be persisted or the next
// refresh fails (same rule as Slack rotation / Google). ensureFreshZoomToken() handles this.
//
// Re-auth (roadmap §3.5): on a hard auth failure the connection flips to status='error' and
// notifyZoomReauthNeeded() fires a system email via the shared Resend transport (lib/resend.ts).
//
// Direct REST only — no Zoom SDK (Chase's standing rule). Token endpoints are plain fetch.

import { z } from "zod";
import { decrypt, encrypt } from "@/lib/crypto/encrypt";
import { sendEmail } from "@/lib/resend";
import {
  type ZoomConnectionFull,
  updateZoomAccessToken,
  updateZoomRefreshToken,
  markZoomConnectionError,
} from "@/lib/pa-zoom-connections";

// ─── Scopes ───────────────────────────────────────────────────────────────────
// Declared on the Zoom app in the Marketplace (User-level OAuth → Scopes tab), NOT on the
// authorize URL. Listed here for documentation + the Connections card chip row. Zoom's granular
// scope names map the task's requested classes:
//   meeting:write → schedule / update / delete the owner's meetings
//   meeting:read  → list + read the owner's meetings (and their join_url)
//   user:read     → read the owner's account (id + email for the connection card + the
//                   /users/{userId}/meetings path)
// Both the classic ("meeting:write") and granular ("meeting:write:meeting") names are accepted by
// Zoom depending on when the app was created; Chase selects the matching set in the Marketplace.
export const ZOOM_SCOPES = ["meeting:read", "meeting:write", "user:read"] as const;

const ZOOM_OAUTH_AUTHORIZE = "https://zoom.us/oauth/authorize";
const ZOOM_OAUTH_TOKEN = "https://zoom.us/oauth/token";
const ZOOM_OAUTH_REVOKE = "https://zoom.us/oauth/revoke";
const ZOOM_API_BASE = "https://api.zoom.us/v2";

// ─── Config gate ──────────────────────────────────────────────────────────────
export type ZoomOAuthConfig = { clientId: string; clientSecret: string };

export function zoomOAuthConfig(): ZoomOAuthConfig | null {
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

/** True iff Zoom OAuth is configured for this deployment (client id + secret on Vercel). */
export function isZoomOAuthConfigured(): boolean {
  return zoomOAuthConfig() !== null;
}

// ─── Redirect URI (single source of truth) ──────────────────────────────────────
// Bit-exact match required between the authorize request and the token exchange, and it must be a
// registered redirect URL on the Zoom app. Derived from PA_OAUTH_REDIRECT_BASE (the same env every
// other connector uses), never the request host.
const DEFAULT_OAUTH_REDIRECT_BASE = "https://aipocketagent.com";

export function zoomRedirectUri(): string {
  const base = (process.env.PA_OAUTH_REDIRECT_BASE ?? DEFAULT_OAUTH_REDIRECT_BASE).replace(
    /\/+$/,
    "",
  );
  return `${base}/api/connections/zoom/callback`;
}

/** Build the Zoom authorize URL. `state` is the signed CSRF token. */
export function buildZoomAuthorizeUrl(clientId: string, state: string): string {
  const url = new URL(ZOOM_OAUTH_AUTHORIZE);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", zoomRedirectUri());
  url.searchParams.set("state", state);
  return url.toString();
}

// ─── Result + error types ────────────────────────────────────────────────────────

export type ZoomResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string; authError: boolean };

/** Thrown when a refresh fails because the Zoom grant is dead — caller flips to reauth. */
export class ReauthNeededError extends Error {
  constructor(message = "Zoom authorization expired") {
    super(message);
    this.name = "ReauthNeededError";
  }
}

// 401/403 or an invalid_grant body means the refresh token is dead and the owner must reconnect.
function isAuthFailure(status: number, body: string): boolean {
  return status === 401 || status === 403 || body.includes("invalid_grant");
}

function basicAuthHeader(config: ZoomOAuthConfig): string {
  return `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`;
}

// ─── Token endpoints ──────────────────────────────────────────────────────────

const TokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  expires_in: z.number().int().positive(),
  scope: z.string().optional(),
  token_type: z.string().optional(),
});
export type ZoomTokenResponse = z.infer<typeof TokenResponseSchema>;

export async function exchangeCodeForTokens(
  code: string,
  config: ZoomOAuthConfig,
): Promise<ZoomResult<ZoomTokenResponse>> {
  const res = await fetch(ZOOM_OAUTH_TOKEN, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(config),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: zoomRedirectUri(),
    }).toString(),
    cache: "no-store",
  });
  return parseTokenResponse(res);
}

export async function refreshAccessToken(
  refreshToken: string,
  config: ZoomOAuthConfig,
): Promise<ZoomResult<ZoomTokenResponse>> {
  const res = await fetch(ZOOM_OAUTH_TOKEN, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(config),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }).toString(),
    cache: "no-store",
  });
  return parseTokenResponse(res);
}

async function parseTokenResponse(res: Response): Promise<ZoomResult<ZoomTokenResponse>> {
  const text = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, error: text, authError: isAuthFailure(res.status, text) };
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

/** Best-effort revoke at Zoom on disconnect. A failure is non-fatal — the row is wiped regardless. */
export async function revokeToken(token: string, config: ZoomOAuthConfig): Promise<void> {
  try {
    await fetch(`${ZOOM_OAUTH_REVOKE}?token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { Authorization: basicAuthHeader(config) },
      cache: "no-store",
    });
  } catch {
    // Revocation is best-effort; the row is soft-deleted regardless.
  }
}

// ─── Account identity (users/me) ────────────────────────────────────────────────
// Fetched right after the grant: zoom_user_id is required on every /users/{userId}/meetings call,
// and the email is the human label on the Connections card.

const UserSchema = z.object({
  id: z.string().min(1),
  email: z.string().optional(),
});
export type ZoomUser = z.infer<typeof UserSchema>;

export async function fetchZoomUser(accessToken: string): Promise<ZoomResult<ZoomUser>> {
  const res = await fetch(`${ZOOM_API_BASE}/users/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
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
  const parsed = UserSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, status: 502, error: "users/me response shape invalid", authError: false };
  }
  return { ok: true, data: parsed.data };
}

// ─── Fresh access token (refresh + persist when expired) ─────────────────────────

/**
 * Return a valid access token for a Zoom connection, refreshing + persisting it when the cached
 * one is missing or within 60s of expiry. Zoom rotates the refresh token on every refresh, so the
 * new refresh token is persisted alongside the access token. On a hard refresh failure the
 * connection is flipped to status='error', a re-auth notice is sent (Resend), and an authError
 * result is returned so the caller can surface the reconnect path.
 */
export async function ensureFreshZoomToken(
  conn: ZoomConnectionFull,
  notifyEmail: string | null,
): Promise<ZoomResult<string>> {
  const config = zoomOAuthConfig();
  if (!config) return { ok: false, status: 503, error: "zoom_not_configured", authError: false };

  const now = Date.now();
  const expiresAt = conn.access_token_expires_at
    ? new Date(conn.access_token_expires_at).getTime()
    : 0;
  if (conn.access_token && expiresAt - 60_000 > now) {
    return { ok: true, data: conn.access_token };
  }

  if (!conn.refresh_token_encrypted) {
    await markZoomConnectionError(conn.id);
    await notifyZoomReauthNeeded(notifyEmail);
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

  const refreshed = await refreshAccessToken(refreshToken, config);
  if (!refreshed.ok) {
    if (refreshed.authError) {
      await markZoomConnectionError(conn.id);
      await notifyZoomReauthNeeded(notifyEmail);
    }
    return refreshed;
  }

  const newExpiry = new Date(now + refreshed.data.expires_in * 1000).toISOString();
  await updateZoomAccessToken(conn.id, refreshed.data.access_token, newExpiry);
  // Zoom issues a fresh refresh token on every refresh — persist it or the next refresh fails.
  if (refreshed.data.refresh_token) {
    await updateZoomRefreshToken(conn.id, encrypt(refreshed.data.refresh_token));
  }
  return { ok: true, data: refreshed.data.access_token };
}

// ─── Re-auth system email (roadmap §3.5 — shared Resend transport) ───────────────

const REAUTH_FROM = "Pocket Agent <agent@aipocketagent.com>";

/**
 * Notify the owner that Zoom disconnected and needs a reconnect. Best-effort: a transport failure
 * (e.g. RESEND_API_KEY unset) is returned, never thrown, so a re-auth never crashes an action. The
 * inline Connections card is the primary signal; this email is the nudge.
 */
export async function notifyZoomReauthNeeded(ownerEmail: string | null): Promise<void> {
  if (!ownerEmail) return;
  const reconnectUrl = `${(process.env.PA_OAUTH_REDIRECT_BASE ?? DEFAULT_OAUTH_REDIRECT_BASE).replace(/\/+$/, "")}/app/settings/connections`;
  await sendEmail({
    from: REAUTH_FROM,
    to: ownerEmail,
    subject: "Reconnect Zoom to keep your agent scheduling calls",
    text:
      "Your Zoom connection stopped working — the authorization was revoked or expired.\n\n" +
      `Reconnect it here to let your agent keep creating and updating Zoom meetings: ${reconnectUrl}\n\n` +
      "Until you reconnect, Zoom actions stay paused.",
    html:
      `<p>Your Zoom connection stopped working — the authorization was revoked or expired.</p>` +
      `<p><a href="${reconnectUrl}">Reconnect Zoom</a> to let your agent keep creating and updating Zoom meetings.</p>` +
      `<p>Until you reconnect, Zoom actions stay paused.</p>`,
  });
}
