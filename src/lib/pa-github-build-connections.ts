/**
 * Data layer for the owner's GitHub Build connection (pa_connections, provider='github_build').
 * Service-role REST only — no SDK, plain fetch against the Supabase REST API, mirroring
 * pa-stripe-connections.ts / pa-slack-connections.ts.
 *
 * This is the BUILD connector: the owner's full-scope GitHub OAuth grant (repo / workflow /
 * delete_repo) so PA can create repos, push code, branch, and open PRs. It is DISTINCT from the
 * brain-read GitHub access (a single-repo PAT used to read/write the brain repo); the two never
 * share a row — provider='github_build' keeps them separate.
 *
 * Storage model:
 *   • refresh_token_encrypted — REPURPOSED to hold the OAuth App ACCESS token (AES-256-GCM via
 *     lib/crypto/encrypt.ts). GitHub OAuth App tokens don't expire and carry no refresh token, so
 *     there is exactly one long-lived secret to store; it lives in the existing encrypted column
 *     rather than the plaintext `access_token` cache column, because this token can create and
 *     delete repos and must never sit in cleartext. Documented here so the repurpose is explicit.
 *   • email — REPURPOSED to store the connected GitHub login (handle) for the Connections card and
 *     for resolving "name"-only repo references to "<login>/<name>" (same repurpose Slack uses for
 *     the workspace name, Stripe for the business name).
 */

export type GithubBuildConnectionStatus = "active" | "revoked" | "error";

export type GithubBuildConnectionPublic = {
  id: string;
  user_id: string;
  provider: "github_build";
  /** Connected GitHub login (handle) — stored in the shared `email` column. */
  login: string | null;
  scopes: string[] | null;
  status: GithubBuildConnectionStatus;
  created_at: string;
  updated_at: string;
};

export type GithubBuildConnectionFull = GithubBuildConnectionPublic & {
  /** Encrypted OAuth access token (the repurposed refresh_token_encrypted column). */
  accessTokenEncrypted: string | null;
};

type PaResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

const TABLE = "pa_connections";
const PROVIDER = "github_build";

const PUBLIC_FIELDS = "id,user_id,provider,email,scopes,status,created_at,updated_at";
const FULL_FIELDS = `${PUBLIC_FIELDS},refresh_token_encrypted`;

type GithubBuildRow = {
  id: string;
  user_id: string;
  provider: "github_build";
  email: string | null;
  scopes: string[] | null;
  status: GithubBuildConnectionStatus;
  created_at: string;
  updated_at: string;
  refresh_token_encrypted?: string | null;
};

function toPublic(row: GithubBuildRow): GithubBuildConnectionPublic {
  return {
    id: row.id,
    user_id: row.user_id,
    provider: "github_build",
    login: row.email,
    scopes: row.scopes,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toFull(row: GithubBuildRow): GithubBuildConnectionFull {
  return { ...toPublic(row), accessTokenEncrypted: row.refresh_token_encrypted ?? null };
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

export async function fetchGithubBuildConnectionPublic(
  userId: string,
): Promise<PaResult<GithubBuildConnectionPublic | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?user_id=eq.${encodeURIComponent(userId)}&provider=eq.${PROVIDER}&select=${PUBLIC_FIELDS}&limit=1`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as GithubBuildRow[];
  return { ok: true, data: rows[0] ? toPublic(rows[0]) : null };
}

export async function fetchGithubBuildConnectionFull(
  userId: string,
): Promise<PaResult<GithubBuildConnectionFull | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?user_id=eq.${encodeURIComponent(userId)}&provider=eq.${PROVIDER}&select=${FULL_FIELDS}&limit=1`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as GithubBuildRow[];
  return { ok: true, data: rows[0] ? toFull(rows[0]) : null };
}

// ─── Writes (service-role) ────────────────────────────────────────────────────

export type UpsertGithubBuildConnectionData = {
  userId: string;
  login: string | null;
  accessTokenEncrypted: string;
  scopes: string[];
};

export async function upsertGithubBuildConnection(
  data: UpsertGithubBuildConnectionData,
): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const body: Record<string, unknown> = {
    user_id: data.userId,
    provider: PROVIDER,
    email: data.login,
    refresh_token_encrypted: data.accessTokenEncrypted,
    scopes: data.scopes,
    status: "active",
    updated_at: new Date().toISOString(),
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

/** Mark a connection broken so write actions stop firing against a revoked token. */
export async function markGithubBuildConnectionError(id: string): Promise<PaResult<void>> {
  return patchById(id, { status: "error", updated_at: new Date().toISOString() });
}

/** Soft-delete on disconnect: revoke status + wipe the token. Row retained for history. */
export async function revokeGithubBuildConnection(userId: string): Promise<PaResult<void>> {
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
