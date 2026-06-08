/**
 * Data layer for the Google Calendar connection (pa_connections, provider='calendar').
 * Service-role REST only — no SDK, plain fetch against the Supabase REST API, mirroring
 * pa-gmail-connections.ts.
 *
 * Two read shapes:
 *   • CalendarConnectionPublic — non-token columns, safe to hand to the UI.
 *   • CalendarConnectionFull   — includes the encrypted refresh token + cached access
 *                                token; server-only (callback, action, approve routes).
 *
 * Calendar is a SEPARATE pa_connections row from Gmail (its own refresh token + scopes +
 * status) so it connects/disconnects independently, but reuses the same Google OAuth client.
 * Encryption lives in lib/crypto/encrypt.ts; this layer stores/returns the blobs verbatim.
 */

export type CalendarConnectionStatus = "active" | "revoked" | "error";

export type CalendarConnectionPublic = {
  id: string;
  user_id: string;
  provider: "calendar";
  email: string | null;
  scopes: string[] | null;
  status: CalendarConnectionStatus;
  created_at: string;
  updated_at: string;
};

export type CalendarConnectionFull = CalendarConnectionPublic & {
  refresh_token_encrypted: string | null;
  access_token: string | null;
  access_token_expires_at: string | null;
};

type PaResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

const TABLE = "pa_connections";
const PROVIDER = "calendar";

const PUBLIC_FIELDS = "id,user_id,provider,email,scopes,status,created_at,updated_at";
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

export async function fetchCalendarConnectionPublic(
  userId: string,
): Promise<PaResult<CalendarConnectionPublic | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?user_id=eq.${encodeURIComponent(userId)}&provider=eq.${PROVIDER}&select=${PUBLIC_FIELDS}&limit=1`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as CalendarConnectionPublic[];
  return { ok: true, data: rows[0] ?? null };
}

export async function fetchCalendarConnectionFull(
  userId: string,
): Promise<PaResult<CalendarConnectionFull | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?user_id=eq.${encodeURIComponent(userId)}&provider=eq.${PROVIDER}&select=${FULL_FIELDS}&limit=1`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as CalendarConnectionFull[];
  return { ok: true, data: rows[0] ?? null };
}

// ─── Writes (service-role) ────────────────────────────────────────────────────

export type UpsertCalendarConnectionData = {
  userId: string;
  email: string | null;
  refreshTokenEncrypted: string | null;
  accessToken: string;
  accessTokenExpiresAt: string;
  scopes: string[];
};

export async function upsertCalendarConnection(
  data: UpsertCalendarConnectionData,
): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const now = new Date().toISOString();
  const body: Record<string, unknown> = {
    user_id: data.userId,
    provider: PROVIDER,
    email: data.email,
    access_token: data.accessToken,
    access_token_expires_at: data.accessTokenExpiresAt,
    scopes: data.scopes,
    status: "active",
    updated_at: now,
  };
  // Only overwrite the stored refresh token when Google actually returned one (it omits
  // it on re-consent unless prompt=consent forces a fresh grant).
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
export async function updateCalendarAccessToken(
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

/** Mark a connection broken so callers stop hammering a dead token (re-auth needed). */
export async function markCalendarConnectionError(id: string): Promise<PaResult<void>> {
  return patchById(id, { status: "error", updated_at: new Date().toISOString() });
}

/** Soft-delete on disconnect: revoke status + wipe tokens. Row is retained for history. */
export async function revokeCalendarConnection(userId: string): Promise<PaResult<void>> {
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
