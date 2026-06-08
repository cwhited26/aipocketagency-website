/**
 * Data layer for the Calendly connection (pa_connections, provider='calendly').
 * Service-role REST only — no SDK, plain fetch against the Supabase REST API, mirroring
 * pa-calendar-connections.ts / pa-quickbooks-connections.ts.
 *
 * Two read shapes:
 *   • CalendlyConnectionPublic — non-token columns, safe to hand to the UI.
 *   • CalendlyConnectionFull   — includes the encrypted refresh token + cached access token;
 *                                server-only (callback, read, approve routes).
 *
 * Storage repurposes one shared column + one dedicated column (pa_connections has no per-provider
 * metadata blob):
 *   • email             — the connected Calendly account's email/name, for the card (same
 *                         repurpose Slack uses for the workspace name). Exposed as `email`.
 *   • calendly_user_uri — the Calendly user resource URI (migration 032). Not a secret; threaded
 *                         into every Calendly API call (scoped to the user). Exposed as `userUri`.
 *
 * Encryption lives in lib/crypto/encrypt.ts; this layer stores/returns the blobs verbatim.
 */

export type CalendlyConnectionStatus = "active" | "revoked" | "error";

export type CalendlyConnectionPublic = {
  id: string;
  user_id: string;
  provider: "calendly";
  email: string | null;
  userUri: string | null;
  scopes: string[] | null;
  status: CalendlyConnectionStatus;
  created_at: string;
  updated_at: string;
};

export type CalendlyConnectionFull = CalendlyConnectionPublic & {
  refresh_token_encrypted: string | null;
  access_token: string | null;
  access_token_expires_at: string | null;
};

type PaResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

const TABLE = "pa_connections";
const PROVIDER = "calendly";

const PUBLIC_FIELDS = "id,user_id,provider,email,calendly_user_uri,scopes,status,created_at,updated_at";
const FULL_FIELDS = `${PUBLIC_FIELDS},refresh_token_encrypted,access_token,access_token_expires_at`;

// The PostgREST row shape (calendly_user_uri is the raw column; we expose it as `userUri`).
type CalendlyRow = {
  id: string;
  user_id: string;
  provider: "calendly";
  email: string | null;
  calendly_user_uri: string | null;
  scopes: string[] | null;
  status: CalendlyConnectionStatus;
  created_at: string;
  updated_at: string;
  refresh_token_encrypted?: string | null;
  access_token?: string | null;
  access_token_expires_at?: string | null;
};

function toPublic(row: CalendlyRow): CalendlyConnectionPublic {
  return {
    id: row.id,
    user_id: row.user_id,
    provider: "calendly",
    email: row.email,
    userUri: row.calendly_user_uri,
    scopes: row.scopes,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toFull(row: CalendlyRow): CalendlyConnectionFull {
  return {
    ...toPublic(row),
    refresh_token_encrypted: row.refresh_token_encrypted ?? null,
    access_token: row.access_token ?? null,
    access_token_expires_at: row.access_token_expires_at ?? null,
  };
}

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

export async function fetchCalendlyConnectionPublic(
  userId: string,
): Promise<PaResult<CalendlyConnectionPublic | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?user_id=eq.${encodeURIComponent(userId)}&provider=eq.${PROVIDER}&select=${PUBLIC_FIELDS}&limit=1`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as CalendlyRow[];
  return { ok: true, data: rows[0] ? toPublic(rows[0]) : null };
}

export async function fetchCalendlyConnectionFull(
  userId: string,
): Promise<PaResult<CalendlyConnectionFull | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?user_id=eq.${encodeURIComponent(userId)}&provider=eq.${PROVIDER}&select=${FULL_FIELDS}&limit=1`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as CalendlyRow[];
  return { ok: true, data: rows[0] ? toFull(rows[0]) : null };
}

// ─── Writes (service-role) ────────────────────────────────────────────────────

export type UpsertCalendlyConnectionData = {
  userId: string;
  email: string | null;
  userUri: string;
  refreshTokenEncrypted: string;
  accessToken: string;
  accessTokenExpiresAt: string;
  scopes: string[];
};

export async function upsertCalendlyConnection(
  data: UpsertCalendlyConnectionData,
): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const now = new Date().toISOString();
  const body: Record<string, unknown> = {
    user_id: data.userId,
    provider: PROVIDER,
    email: data.email,
    calendly_user_uri: data.userUri,
    refresh_token_encrypted: data.refreshTokenEncrypted,
    access_token: data.accessToken,
    access_token_expires_at: data.accessTokenExpiresAt,
    scopes: data.scopes,
    status: "active",
    updated_at: now,
  };

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
export async function updateCalendlyAccessToken(
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

/** Persist a rotated refresh token (Calendly may rotate it on refresh). Stored already-encrypted. */
export async function updateCalendlyRefreshToken(
  id: string,
  refreshTokenEncrypted: string,
): Promise<PaResult<void>> {
  return patchById(id, {
    refresh_token_encrypted: refreshTokenEncrypted,
    updated_at: new Date().toISOString(),
  });
}

/** Mark a connection broken so callers stop hammering a dead token (re-auth needed). */
export async function markCalendlyConnectionError(id: string): Promise<PaResult<void>> {
  return patchById(id, { status: "error", updated_at: new Date().toISOString() });
}

/** Soft-delete on disconnect: revoke status + wipe tokens. Row is retained for history. */
export async function revokeCalendlyConnection(userId: string): Promise<PaResult<void>> {
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
