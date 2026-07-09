// oauth.ts — the GHL Marketplace OAuth lifecycle (SPEC §5.1). Direct fetch, Zod at every
// boundary, no SDK. Three token moves:
//
//   1. exchangeCodeForTokens — authorize code → agency (Company) access + refresh pair.
//   2. refreshAgencyTokens   — refresh grant. GHL rotates BOTH tokens on refresh (refresh
//      tokens are single-use), so the caller must persist the new pair immediately.
//   3. mintLocationToken     — POST /oauth/locationToken. GHL's contact/conversation/calendar
//      endpoints reject an agency token; per-location calls ride a short-lived Location token
//      minted from the agency token. Minted per execution, never persisted — one fewer
//      ciphertext class at rest.
//
// ensureFreshAgencyToken wraps the cached-vs-refresh decision the Gmail connector's
// ensureFreshAccessToken established, persisting rotated pairs and flipping the connection to
// needs_reauth when the refresh grant dies.

import { z } from "zod";
import {
  ghlApiBase,
  ghlAuthorizeBase,
  ghlOauthCreds,
  ghlRedirectUri,
  GHL_OAUTH_SCOPES,
  GHL_VERSION_LOCATIONS,
} from "./config";
import { decryptGhlToken, encryptGhlToken } from "./crypto";
import {
  markGhlConnectionNeedsReauth,
  updateGhlTokens,
  type GhlConnectionFull,
} from "./store";

export type GhlOauthResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string; authError: boolean };

// 401, or an OAuth body carrying invalid_grant, means the refresh token is dead — the caller
// flips the connection to needs_reauth rather than retrying.
function isAuthFailure(status: number, body: string): boolean {
  return status === 401 || status === 403 || body.includes("invalid_grant");
}

const TokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number().int().positive(),
  scope: z.string().optional(),
  token_type: z.string().optional(),
  userType: z.enum(["Company", "Location"]).optional(),
  companyId: z.string().optional(),
  locationId: z.string().optional(),
});
export type GhlTokenResponse = z.infer<typeof TokenResponseSchema>;

const LocationTokenSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive().optional(),
  locationId: z.string().optional(),
});

/** The Marketplace consent URL the authorize route redirects to. */
export function buildGhlAuthorizeUrl(clientId: string, state: string): string {
  const url = new URL(ghlAuthorizeBase());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", ghlRedirectUri());
  url.searchParams.set("scope", GHL_OAUTH_SCOPES.join(" "));
  url.searchParams.set("state", state);
  return url.toString();
}

async function parseTokenResponse(res: Response): Promise<GhlOauthResult<GhlTokenResponse>> {
  const text = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, error: text, authError: isAuthFailure(res.status, text) };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, status: 502, error: "GHL token endpoint returned non-JSON", authError: false };
  }
  const parsed = TokenResponseSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, status: 502, error: "GHL token response shape invalid", authError: false };
  }
  return { ok: true, data: parsed.data };
}

export async function exchangeCodeForTokens(
  code: string,
): Promise<GhlOauthResult<GhlTokenResponse>> {
  const creds = ghlOauthCreds();
  if (!creds) return { ok: false, status: 500, error: "ghl_oauth_not_configured", authError: false };
  const res = await fetch(`${ghlApiBase()}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      grant_type: "authorization_code",
      code,
      user_type: "Company",
      redirect_uri: ghlRedirectUri(),
    }).toString(),
    cache: "no-store",
  });
  return parseTokenResponse(res);
}

export async function refreshAgencyTokens(
  refreshToken: string,
  userType: "Company" | "Location",
): Promise<GhlOauthResult<GhlTokenResponse>> {
  const creds = ghlOauthCreds();
  if (!creds) return { ok: false, status: 500, error: "ghl_oauth_not_configured", authError: false };
  const res = await fetch(`${ghlApiBase()}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      user_type: userType,
      redirect_uri: ghlRedirectUri(),
    }).toString(),
    cache: "no-store",
  });
  return parseTokenResponse(res);
}

/**
 * A valid agency access token for this connection: the cached one when it's more than 60s from
 * expiry, else refresh + persist the rotated pair. On a dead refresh grant the connection flips
 * to needs_reauth so the UI tells the owner to reconnect instead of the cron hammering it.
 */
export async function ensureFreshAgencyToken(
  conn: GhlConnectionFull,
): Promise<GhlOauthResult<string>> {
  const now = Date.now();
  const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
  if (conn.access_token_encrypted && expiresAt - 60_000 > now) {
    try {
      return { ok: true, data: decryptGhlToken(conn.access_token_encrypted) };
    } catch (err) {
      return {
        ok: false,
        status: 500,
        error: err instanceof Error ? err.message : "decrypt_failed",
        authError: false,
      };
    }
  }

  if (!conn.refresh_token_encrypted) {
    return { ok: false, status: 401, error: "no_refresh_token", authError: true };
  }
  let refreshToken: string;
  try {
    refreshToken = decryptGhlToken(conn.refresh_token_encrypted);
  } catch (err) {
    return {
      ok: false,
      status: 500,
      error: err instanceof Error ? err.message : "decrypt_failed",
      authError: false,
    };
  }

  const refreshed = await refreshAgencyTokens(refreshToken, conn.user_type);
  if (!refreshed.ok) {
    if (refreshed.authError) await markGhlConnectionNeedsReauth(conn.id);
    return refreshed;
  }

  const persisted = await updateGhlTokens(conn.id, {
    accessTokenEncrypted: encryptGhlToken(refreshed.data.access_token),
    refreshTokenEncrypted: encryptGhlToken(refreshed.data.refresh_token),
    tokenExpiresAt: new Date(now + refreshed.data.expires_in * 1000).toISOString(),
  });
  if (!persisted.ok) {
    // The rotated refresh token MUST land in storage — GHL refresh tokens are single-use, so
    // losing it strands the connection. Surface the failure; do not hand out the token as if
    // the lifecycle were healthy.
    return { ok: false, status: persisted.status, error: `token persist failed: ${persisted.error}`, authError: false };
  }
  return { ok: true, data: refreshed.data.access_token };
}

/**
 * Mint a Location access token from the agency token (POST /oauth/locationToken). Required for
 * every contact / conversation / calendar call — GHL rejects agency tokens on those endpoints.
 * Short-lived and never persisted.
 */
export async function mintLocationToken(
  agencyAccessToken: string,
  companyId: string,
  locationId: string,
): Promise<GhlOauthResult<string>> {
  const res = await fetch(`${ghlApiBase()}/oauth/locationToken`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${agencyAccessToken}`,
      Version: GHL_VERSION_LOCATIONS,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ companyId, locationId }).toString(),
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
    return { ok: false, status: 502, error: "locationToken returned non-JSON", authError: false };
  }
  const parsed = LocationTokenSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, status: 502, error: "locationToken response shape invalid", authError: false };
  }
  return { ok: true, data: parsed.data.access_token };
}
