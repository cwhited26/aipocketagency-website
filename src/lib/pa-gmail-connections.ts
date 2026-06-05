/**
 * Data layer for pa_connections (Connections v1) — service-role REST only.
 *
 * Two read shapes:
 *   • GmailConnectionPublic — non-token columns, safe to hand to the UI.
 *   • GmailConnectionFull   — includes the encrypted refresh token + cached
 *                             access token; server-only (callback, action, cron).
 *
 * No SDK — plain fetch against the Supabase REST API, matching pa-connections.ts
 * and pa-inbox-items.ts. Encryption lives in lib/crypto/encrypt.ts; this layer
 * stores and returns whatever blobs it is handed.
 */

export type GmailConnectionStatus = "active" | "revoked" | "error";

export type GmailConnectionPublic = {
  id: string;
  user_id: string;
  provider: "gmail";
  email: string | null;
  scopes: string[] | null;
  status: GmailConnectionStatus;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
};

export type GmailConnectionFull = GmailConnectionPublic & {
  refresh_token_encrypted: string | null;
  access_token: string | null;
  access_token_expires_at: string | null;
  last_sync_history_id: string | null;
};

type PaResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

const TABLE = "pa_connections";

const PUBLIC_FIELDS =
  "id,user_id,provider,email,scopes,status,last_sync_at,created_at,updated_at";
const FULL_FIELDS =
  `${PUBLIC_FIELDS},refresh_token_encrypted,access_token,access_token_expires_at,last_sync_history_id`;

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

export async function fetchGmailConnectionPublic(
  userId: string,
): Promise<PaResult<GmailConnectionPublic | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?user_id=eq.${encodeURIComponent(userId)}&provider=eq.gmail&select=${PUBLIC_FIELDS}&limit=1`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as GmailConnectionPublic[];
  return { ok: true, data: rows[0] ?? null };
}

export async function fetchGmailConnectionFull(
  userId: string,
): Promise<PaResult<GmailConnectionFull | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?user_id=eq.${encodeURIComponent(userId)}&provider=eq.gmail&select=${FULL_FIELDS}&limit=1`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as GmailConnectionFull[];
  return { ok: true, data: rows[0] ?? null };
}

/** All active gmail connections — the cron's work-list. */
export async function fetchActiveGmailConnections(): Promise<PaResult<GmailConnectionFull[]>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?provider=eq.gmail&status=eq.active&select=${FULL_FIELDS}`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as GmailConnectionFull[];
  return { ok: true, data: rows };
}

// ─── Writes (service-role) ────────────────────────────────────────────────────

export type UpsertGmailConnectionData = {
  userId: string;
  email: string | null;
  refreshTokenEncrypted: string | null;
  accessToken: string;
  accessTokenExpiresAt: string;
  scopes: string[];
};

export async function upsertGmailConnection(
  data: UpsertGmailConnectionData,
): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const now = new Date().toISOString();
  const body: Record<string, unknown> = {
    user_id: data.userId,
    provider: "gmail",
    email: data.email,
    access_token: data.accessToken,
    access_token_expires_at: data.accessTokenExpiresAt,
    scopes: data.scopes,
    status: "active",
    updated_at: now,
  };
  // Only overwrite the stored refresh token when Google actually returned one
  // (it omits it on re-consent unless prompt=consent forces a fresh grant).
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

/** Cache a freshly minted access token + expiry on the row (cron / action refresh). */
export async function updateGmailAccessToken(
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

/** Advance the sync cursor after a cron batch. */
export async function updateGmailSyncCursor(
  id: string,
  params: { lastSyncAt: string; lastSyncHistoryId: string | null },
): Promise<PaResult<void>> {
  const patch: Record<string, unknown> = {
    last_sync_at: params.lastSyncAt,
    updated_at: new Date().toISOString(),
  };
  if (params.lastSyncHistoryId !== null) {
    patch.last_sync_history_id = params.lastSyncHistoryId;
  }
  return patchById(id, patch);
}

/** Mark a connection broken so the cron stops hammering a dead token. */
export async function markGmailConnectionError(id: string): Promise<PaResult<void>> {
  return patchById(id, { status: "error", updated_at: new Date().toISOString() });
}

/** Soft-delete on disconnect: revoke status + wipe tokens. Row is retained for history. */
export async function revokeGmailConnection(userId: string): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?user_id=eq.${encodeURIComponent(userId)}&provider=eq.gmail`,
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
