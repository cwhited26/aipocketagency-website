/**
 * Data layer for the Supabase Build Connection (pa_connections, provider='supabase').
 * Service-role REST only — no SDK, plain fetch against the Supabase REST API, mirroring
 * pa-quickbooks-connections.ts / pa-slack-connections.ts.
 *
 * The connection stores the owner's Supabase Personal Access Token (Management API) — pasted
 * once, AES-256-GCM-encrypted at rest via lib/crypto/encrypt.ts, never returned to the UI.
 *
 * Two read shapes:
 *   • SupabaseConnectionPublic — non-token columns, safe to hand to the UI.
 *   • SupabaseConnectionFull   — includes the encrypted PAT; server-only (connect / action /
 *                                approve routes), decrypted at the point of use.
 *
 * Column repurposes (pa_connections has no per-provider metadata blob):
 *   • refresh_token_encrypted — the encrypted PAT (it IS the long-lived credential).
 *   • email                   — the default ORG NAME, for the card label (same repurpose Slack
 *                               uses for the workspace name). Exposed here as `orgName`.
 *   • supabase_org_id         — the default org id (migration 045). Not a secret; the default
 *                               target for createProject. Exposed here as `orgId`.
 */

import { encrypt, decrypt } from "@/lib/crypto/encrypt";

export type SupabaseConnectionStatus = "active" | "revoked" | "error";

export type SupabaseConnectionPublic = {
  id: string;
  user_id: string;
  provider: "supabase";
  /** Default org display name — stored in the shared `email` column (see file header). */
  orgName: string | null;
  orgId: string | null;
  status: SupabaseConnectionStatus;
  created_at: string;
  updated_at: string;
};

export type SupabaseConnectionFull = SupabaseConnectionPublic & {
  /** The decrypted Personal Access Token, or null if decryption failed / no token stored. */
  pat: string | null;
};

type PaResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

const TABLE = "pa_connections";
const PROVIDER = "supabase";

const PUBLIC_FIELDS = "id,user_id,provider,email,supabase_org_id,status,created_at,updated_at";
const FULL_FIELDS = `${PUBLIC_FIELDS},refresh_token_encrypted`;

type SupabaseRow = {
  id: string;
  user_id: string;
  provider: "supabase";
  email: string | null;
  supabase_org_id: string | null;
  status: SupabaseConnectionStatus;
  created_at: string;
  updated_at: string;
  refresh_token_encrypted?: string | null;
};

function toPublic(row: SupabaseRow): SupabaseConnectionPublic {
  return {
    id: row.id,
    user_id: row.user_id,
    provider: "supabase",
    orgName: row.email,
    orgId: row.supabase_org_id,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
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

export async function fetchSupabaseConnectionPublic(
  userId: string,
): Promise<PaResult<SupabaseConnectionPublic | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?user_id=eq.${encodeURIComponent(userId)}&provider=eq.${PROVIDER}&select=${PUBLIC_FIELDS}&limit=1`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as SupabaseRow[];
  return { ok: true, data: rows[0] ? toPublic(rows[0]) : null };
}

export async function fetchSupabaseConnectionFull(
  userId: string,
): Promise<PaResult<SupabaseConnectionFull | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?user_id=eq.${encodeURIComponent(userId)}&provider=eq.${PROVIDER}&select=${FULL_FIELDS}&limit=1`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as SupabaseRow[];
  const row = rows[0];
  if (!row) return { ok: true, data: null };

  let pat: string | null = null;
  if (row.refresh_token_encrypted) {
    try {
      pat = decrypt(row.refresh_token_encrypted);
    } catch {
      // A decrypt failure (rotated key / corrupt blob) is surfaced as a null token; the caller
      // treats it as "reconnect needed" rather than crashing. Not a silent success — pat stays null.
      pat = null;
    }
  }
  return { ok: true, data: { ...toPublic(row), pat } };
}

// ─── Writes (service-role) ────────────────────────────────────────────────────

export type UpsertSupabaseConnectionData = {
  userId: string;
  /** Plaintext PAT — encrypted here before it touches the row. */
  pat: string;
  orgId: string | null;
  orgName: string | null;
};

export async function upsertSupabaseConnection(
  data: UpsertSupabaseConnectionData,
): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const now = new Date().toISOString();
  const body: Record<string, unknown> = {
    user_id: data.userId,
    provider: PROVIDER,
    email: data.orgName,
    supabase_org_id: data.orgId,
    refresh_token_encrypted: encrypt(data.pat),
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

/** Mark the connection broken (a 401/403 from the Management API means the PAT was revoked). */
export async function markSupabaseConnectionError(id: string): Promise<PaResult<void>> {
  return patchById(id, { status: "error", updated_at: new Date().toISOString() });
}

/** Soft-delete on disconnect: revoke status + wipe the encrypted PAT. Row retained for history. */
export async function revokeSupabaseConnection(userId: string): Promise<PaResult<void>> {
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
