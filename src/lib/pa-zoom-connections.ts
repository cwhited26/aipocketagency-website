/**
 * Data layer for the owner's Zoom connection (pa_connections, provider='zoom').
 * Service-role REST only — no SDK, plain fetch against the Supabase REST API, mirroring
 * pa-calendar-connections.ts / pa-slack-connections.ts.
 *
 * Each PA owner connects THEIR own Zoom account via User-level OAuth. Zoom is a SEPARATE
 * pa_connections row (its own refresh token + scopes + status) so it connects/disconnects
 * independently of the other connectors. Encryption lives in lib/crypto/encrypt.ts; this layer
 * stores/returns the blobs verbatim.
 *
 * Storage model:
 *   • refresh_token_encrypted — Zoom refresh token (rotated on every refresh), AES-256-GCM.
 *   • access_token / access_token_expires_at — the short-lived (~1h) access token + expiry,
 *     refreshed near expiry by ensureFreshZoomToken (oauth.ts).
 *   • zoom_user_id — the owner's Zoom user id, returned by users/me at connect time. NOT a secret;
 *     its own plaintext column (migration 032). Required on every /users/{userId}/meetings call.
 *   • email column stores the owner's Zoom account email for the Connections card.
 */

export type ZoomConnectionStatus = "active" | "revoked" | "error";

export type ZoomConnectionPublic = {
  id: string;
  user_id: string;
  provider: "zoom";
  email: string | null;
  zoom_user_id: string | null;
  scopes: string[] | null;
  status: ZoomConnectionStatus;
  created_at: string;
  updated_at: string;
};

export type ZoomConnectionFull = ZoomConnectionPublic & {
  refresh_token_encrypted: string | null;
  access_token: string | null;
  access_token_expires_at: string | null;
};

type PaResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

const TABLE = "pa_connections";
const PROVIDER = "zoom";

const PUBLIC_FIELDS =
  "id,user_id,provider,email,zoom_user_id,scopes,status,created_at,updated_at";
const FULL_FIELDS = `${PUBLIC_FIELDS},refresh_token_encrypted,access_token,access_token_expires_at`;

function paEnv(): { url: string; key: string } | { error: string } {
  const url =
    process.env.POCKET_AGENT_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.WC_ADMIN_SUPABASE_URL;
  const key =
    process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.WC_ADMIN_SUPABASE_SERVICE_KEY;
  if (!url || !key) return { error: "Supabase service-role env vars not set" };
  return { url: url.replace(/\/$/, ""), key };
}

function authHeaders(key: string): Record<string, string> {
  return { apikey: key, Authorization: `Bearer ${key}` };
}

// ─── Reads ────────────────────────────────────────────────────────────────────

export async function fetchZoomConnectionPublic(
  userId: string,
): Promise<PaResult<ZoomConnectionPublic | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?user_id=eq.${encodeURIComponent(userId)}&provider=eq.${PROVIDER}&select=${PUBLIC_FIELDS}&limit=1`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as ZoomConnectionPublic[];
  return { ok: true, data: rows[0] ?? null };
}

export async function fetchZoomConnectionFull(
  userId: string,
): Promise<PaResult<ZoomConnectionFull | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?user_id=eq.${encodeURIComponent(userId)}&provider=eq.${PROVIDER}&select=${FULL_FIELDS}&limit=1`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as ZoomConnectionFull[];
  return { ok: true, data: rows[0] ?? null };
}

// ─── Writes (service-role) ────────────────────────────────────────────────────

export type UpsertZoomConnectionData = {
  userId: string;
  email: string | null;
  zoomUserId: string;
  refreshTokenEncrypted: string | null;
  accessToken: string;
  accessTokenExpiresAt: string;
  scopes: string[];
};

export async function upsertZoomConnection(
  data: UpsertZoomConnectionData,
): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const now = new Date().toISOString();
  const body: Record<string, unknown> = {
    user_id: data.userId,
    provider: PROVIDER,
    email: data.email,
    zoom_user_id: data.zoomUserId,
    access_token: data.accessToken,
    access_token_expires_at: data.accessTokenExpiresAt,
    scopes: data.scopes,
    status: "active",
    updated_at: now,
  };
  // Persist the refresh token whenever Zoom returned one (it does on every successful grant).
  if (data.refreshTokenEncrypted !== null) {
    body.refresh_token_encrypted = data.refreshTokenEncrypted;
  }

  const res = await fetch(`${env.url}/rest/v1/${TABLE}?on_conflict=user_id,provider`, {
    method: "POST",
    headers: {
      ...authHeaders(env.key),
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}

/** Cache a freshly minted access token + expiry on the row (token refresh). */
export async function updateZoomAccessToken(
  id: string,
  accessToken: string,
  accessTokenExpiresAt: string,
): Promise<PaResult<void>> {
  return patchById(id, {
    access_token: accessToken,
    access_token_expires_at: accessTokenExpiresAt,
    status: "active",
    updated_at: new Date().toISOString(),
  });
}

/** Persist a rotated refresh token (Zoom issues a fresh one on every refresh). */
export async function updateZoomRefreshToken(
  id: string,
  refreshTokenEncrypted: string,
): Promise<PaResult<void>> {
  return patchById(id, {
    refresh_token_encrypted: refreshTokenEncrypted,
    updated_at: new Date().toISOString(),
  });
}

/** Mark a connection broken so callers stop hammering a dead token (re-auth needed). */
export async function markZoomConnectionError(id: string): Promise<PaResult<void>> {
  return patchById(id, { status: "error", updated_at: new Date().toISOString() });
}

/** Soft-delete on disconnect: revoke status + wipe tokens. Row is retained for history. */
export async function revokeZoomConnection(userId: string): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?user_id=eq.${encodeURIComponent(userId)}&provider=eq.${PROVIDER}`,
    {
      method: "PATCH",
      headers: {
        ...authHeaders(env.key),
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        status: "revoked",
        refresh_token_encrypted: null,
        access_token: null,
        access_token_expires_at: null,
        updated_at: new Date().toISOString(),
      }),
      cache: "no-store",
    },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}

async function patchById(id: string, patch: Record<string, unknown>): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(`${env.url}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      ...authHeaders(env.key),
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(patch),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}
