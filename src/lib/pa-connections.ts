/**
 * Data layer for pocket_agent_connections — service-role REST only.
 * Encrypted token fields are never returned to callers; upsert accepts
 * pre-encrypted blobs produced by pa-vault.
 */

export type ConnectionProvider = "google_gmail" | "google_calendar";
export type ConnectionStatus = "connected" | "disconnected" | "error";

export type ConnectionRow = {
  id: string;
  user_id: string;
  provider: ConnectionProvider;
  status: ConnectionStatus;
  account_email: string | null;
  scopes: string[] | null;
  expires_at: string | null;
  connected_at: string | null;
  created_at: string;
  updated_at: string;
};

type PaResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

function connEnv(): { url: string; key: string } | { error: string } {
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

const TABLE = "pocket_agent_connections";

const PUBLIC_FIELDS =
  "id,user_id,provider,status,account_email,scopes,expires_at,connected_at,created_at,updated_at";

export async function fetchUserConnections(
  userId: string,
): Promise<PaResult<ConnectionRow[]>> {
  const env = connEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const endpoint = `${env.url}/rest/v1/${TABLE}?user_id=eq.${encodeURIComponent(userId)}&select=${PUBLIC_FIELDS}`;
  const res = await fetch(endpoint, {
    headers: { apikey: env.key, Authorization: `Bearer ${env.key}` },
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as ConnectionRow[];
  return { ok: true, data: rows };
}

export type UpsertConnectionData = {
  userId: string;
  provider: ConnectionProvider;
  encryptedAccessToken: string;
  encryptedRefreshToken: string | null;
  scopes: string[];
  accountEmail: string | null;
  expiresAt: string;
};

export async function upsertConnection(
  data: UpsertConnectionData,
): Promise<PaResult<void>> {
  const env = connEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const now = new Date().toISOString();
  const body = {
    user_id: data.userId,
    provider: data.provider,
    status: "connected" satisfies ConnectionStatus,
    encrypted_access_token: data.encryptedAccessToken,
    encrypted_refresh_token: data.encryptedRefreshToken,
    scopes: data.scopes,
    account_email: data.accountEmail,
    expires_at: data.expiresAt,
    connected_at: now,
    updated_at: now,
  };

  const endpoint = `${env.url}/rest/v1/${TABLE}?on_conflict=user_id,provider`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: env.key,
      Authorization: `Bearer ${env.key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}

export async function disconnectConnection(
  userId: string,
  provider: ConnectionProvider,
): Promise<PaResult<void>> {
  const env = connEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const endpoint = `${env.url}/rest/v1/${TABLE}?user_id=eq.${encodeURIComponent(userId)}&provider=eq.${encodeURIComponent(provider)}`;
  const res = await fetch(endpoint, {
    method: "PATCH",
    headers: {
      apikey: env.key,
      Authorization: `Bearer ${env.key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      status: "disconnected" satisfies ConnectionStatus,
      encrypted_access_token: null,
      encrypted_refresh_token: null,
      account_email: null,
      expires_at: null,
      updated_at: new Date().toISOString(),
    }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}
