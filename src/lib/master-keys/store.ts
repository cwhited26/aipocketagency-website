// store.ts — service-role data layer for the master-keyed workspace tables (migration 110).
// Direct PostgREST, no SDK — matches lib/ghl-waitlist/store.ts and lib/pa-supabase.ts.

const MASTER_KEYS = "pa_master_keys";
const WORKSPACES = "pa_workspaces";
const AUDIT = "pa_master_key_audit";

export type MasterKeyRow = {
  id: string;
  product_slug: string;
  master_key_hash: string;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
};

export type WorkspaceRow = {
  id: string;
  source_master_key_id: string;
  external_workspace_id: string;
  external_slug: string | null;
  owner_email: string;
  api_key_hashed: string;
  tier: string;
  created_at: string;
};

export type StoreResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

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

function headers(key: string, extra: Record<string, string> = {}): Record<string, string> {
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...extra };
}

/** Look up an ACTIVE master key by its SHA-256 hash. Returns null when no active match. */
export async function findActiveMasterKeyByHash(hash: string): Promise<StoreResult<MasterKeyRow | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const url = `${env.url}/rest/v1/${MASTER_KEYS}?master_key_hash=eq.${encodeURIComponent(hash)}&is_active=eq.true&limit=1`;
  const res = await fetch(url, { headers: headers(env.key), cache: "no-store" });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as MasterKeyRow[];
  return { ok: true, data: rows[0] ?? null };
}

/** Find an existing workspace by (owning master key, external workspace id). */
export async function findWorkspace(
  masterKeyId: string,
  externalWorkspaceId: string,
): Promise<StoreResult<WorkspaceRow | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const url =
    `${env.url}/rest/v1/${WORKSPACES}` +
    `?source_master_key_id=eq.${encodeURIComponent(masterKeyId)}` +
    `&external_workspace_id=eq.${encodeURIComponent(externalWorkspaceId)}&limit=1`;
  const res = await fetch(url, { headers: headers(env.key), cache: "no-store" });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as WorkspaceRow[];
  return { ok: true, data: rows[0] ?? null };
}

/** Insert a new workspace row. api_key_hashed is the SHA-256 of the freshly minted key. */
export async function insertWorkspace(input: {
  source_master_key_id: string;
  external_workspace_id: string;
  external_slug: string;
  owner_email: string;
  api_key_hashed: string;
}): Promise<StoreResult<WorkspaceRow>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(`${env.url}/rest/v1/${WORKSPACES}`, {
    method: "POST",
    headers: headers(env.key, { Prefer: "return=representation" }),
    body: JSON.stringify(input),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) return { ok: false, status: res.status, error: text };
  const rows = JSON.parse(text) as WorkspaceRow[];
  const row = rows[0];
  if (!row) return { ok: false, status: 500, error: "PostgREST returned no row" };
  return { ok: true, data: row };
}

/**
 * Re-key an existing workspace. We store hashes only, so the original plaintext key can never
 * be returned on a repeat call — a repeat "Connect" rotates the key (updates the hash) and
 * returns the fresh plaintext. The caller overwrites its stored key with what we return.
 */
export async function rotateWorkspaceKey(
  workspaceId: string,
  newHash: string,
): Promise<StoreResult<WorkspaceRow>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(`${env.url}/rest/v1/${WORKSPACES}?id=eq.${encodeURIComponent(workspaceId)}`, {
    method: "PATCH",
    headers: headers(env.key, { Prefer: "return=representation" }),
    body: JSON.stringify({ api_key_hashed: newHash }),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) return { ok: false, status: res.status, error: text };
  const rows = JSON.parse(text) as WorkspaceRow[];
  const row = rows[0];
  if (!row) return { ok: false, status: 500, error: "PostgREST returned no row" };
  return { ok: true, data: row };
}

/** Best-effort last_used_at touch on the master key. Never blocks the request. */
export async function touchMasterKey(masterKeyId: string): Promise<void> {
  const env = paEnv();
  if ("error" in env) return;
  await fetch(`${env.url}/rest/v1/${MASTER_KEYS}?id=eq.${encodeURIComponent(masterKeyId)}`, {
    method: "PATCH",
    headers: headers(env.key),
    body: JSON.stringify({ last_used_at: new Date().toISOString() }),
    cache: "no-store",
  }).catch(() => undefined);
}

/** Best-effort audit insert — one row per call. A logging failure never fails the request. */
export async function insertAudit(input: {
  master_key_id: string | null;
  action: string;
  external_workspace_id: string | null;
  ip: string | null;
  user_agent: string | null;
  status_code: number;
}): Promise<void> {
  const env = paEnv();
  if ("error" in env) return;
  await fetch(`${env.url}/rest/v1/${AUDIT}`, {
    method: "POST",
    headers: headers(env.key),
    body: JSON.stringify(input),
    cache: "no-store",
  }).catch(() => undefined);
}
