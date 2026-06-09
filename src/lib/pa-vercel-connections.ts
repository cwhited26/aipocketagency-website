// pa-vercel-connections.ts — the Vercel build connector's connection (pa_connections, provider='vercel').
//
// Vercel has no user-facing OAuth, so — like Lead Scout's Bright Data key — the owner pastes a
// Vercel personal or team API token once. We store it AES-256-GCM encrypted (lib/crypto/encrypt.ts,
// key GMAIL_TOKEN_ENCRYPTION_KEY) inside pa_connections.config jsonb rather than in a refresh-token
// column, because there is no token to refresh — one long-lived pasted token.
//
// config shape: { token_encrypted: "v1.…", team_id?: "team_…", account_label?: "…" }.
//   • team_id — optional; threaded onto every Vercel API call as ?teamId= so create/deploy target
//     the owner's team rather than their personal scope. Null = personal scope.
//   • account_label — the username / team slug the test call resolved, shown on the Connections card.
//
// All writes use the service-role key; RLS lets the owner SELECT their own row. The ciphertext is
// only ever returned to the executor (resolveVercelToken); the UI view (…Public) strips it.

import { encrypt, decrypt } from "@/lib/crypto/encrypt";

export const VERCEL_PROVIDER = "vercel" as const;

type VercelConfig = {
  token_encrypted?: string;
  team_id?: string;
  account_label?: string;
};

type PaResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

/** The non-secret view the Connections card renders — never the ciphertext. */
export type VercelConnectionPublic = {
  status: "active" | "revoked" | "error";
  /** True once a token is on file. */
  hasToken: boolean;
  /** The owner's Vercel team id, when the token is scoped to a team. */
  teamId: string | null;
  /** The username / team slug the connect-time test resolved (display only). */
  accountLabel: string | null;
};

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

type ConnectionRow = {
  status: "active" | "revoked" | "error";
  config: VercelConfig | null;
};

async function fetchRow(userId: string): Promise<PaResult<ConnectionRow | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const endpoint =
    `${env.url}/rest/v1/pa_connections` +
    `?user_id=eq.${encodeURIComponent(userId)}&provider=eq.${VERCEL_PROVIDER}` +
    `&select=status,config&limit=1`;
  const res = await fetch(endpoint, { headers: authHeaders(env.key), cache: "no-store" });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as ConnectionRow[];
  return { ok: true, data: rows[0] ?? null };
}

/** Public, ciphertext-free view for the Connections settings card. */
export async function fetchVercelConnectionPublic(
  userId: string,
): Promise<PaResult<VercelConnectionPublic | null>> {
  const row = await fetchRow(userId);
  if (!row.ok) return row;
  if (!row.data) return { ok: true, data: null };
  const config = row.data.config ?? {};
  return {
    ok: true,
    data: {
      status: row.data.status,
      hasToken: Boolean(config.token_encrypted),
      teamId: config.team_id ?? null,
      accountLabel: config.account_label ?? null,
    },
  };
}

/**
 * Store (or update) the owner's Vercel connection. The pasted token is encrypted into the config
 * blob; team_id + account_label are non-secret display/scoping fields. Upserts the single row per
 * (user, provider).
 */
export async function storeVercelConnection(params: {
  userId: string;
  token: string;
  teamId: string | null;
  accountLabel: string | null;
}): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const config: VercelConfig = { token_encrypted: encrypt(params.token) };
  if (params.teamId) config.team_id = params.teamId;
  if (params.accountLabel) config.account_label = params.accountLabel;

  const body = {
    user_id: params.userId,
    provider: VERCEL_PROVIDER,
    email: "Vercel",
    config,
    status: "active",
    updated_at: new Date().toISOString(),
  };

  const res = await fetch(`${env.url}/rest/v1/pa_connections?on_conflict=user_id,provider`, {
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

/** Disconnect — flip the row to revoked and clear the stored token from config. */
export async function disconnectVercelConnection(userId: string): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const endpoint =
    `${env.url}/rest/v1/pa_connections` +
    `?user_id=eq.${encodeURIComponent(userId)}&provider=eq.${VERCEL_PROVIDER}`;
  const res = await fetch(endpoint, {
    method: "PATCH",
    headers: { ...authHeaders(env.key), "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ status: "revoked", config: {}, updated_at: new Date().toISOString() }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}

/** Mark the connection broken so callers stop hammering a dead token (re-auth needed). */
export async function markVercelConnectionError(userId: string): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const endpoint =
    `${env.url}/rest/v1/pa_connections` +
    `?user_id=eq.${encodeURIComponent(userId)}&provider=eq.${VERCEL_PROVIDER}`;
  const res = await fetch(endpoint, {
    method: "PATCH",
    headers: { ...authHeaders(env.key), "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ status: "error", updated_at: new Date().toISOString() }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}

export type ResolvedVercelToken =
  | { ok: true; token: string; teamId: string | null }
  | { ok: false; status: number; error: string };

/**
 * The single read the executor makes to get the Vercel token to actually use. Decrypts the stored
 * token and returns it with the team scope. Returns a typed error (never throws) so an action
 * records a clean failure instead of crashing.
 */
export async function resolveVercelToken(userId: string): Promise<ResolvedVercelToken> {
  const row = await fetchRow(userId);
  if (!row.ok) return { ok: false, status: row.status, error: row.error };
  if (!row.data || row.data.status === "revoked") {
    return {
      ok: false,
      status: 409,
      error: "Connect Vercel in Settings → Connections before running a build action.",
    };
  }
  const config = row.data.config ?? {};
  if (!config.token_encrypted) {
    return {
      ok: false,
      status: 409,
      error: "No Vercel token on file. Add one in Settings → Connections → Vercel.",
    };
  }
  try {
    return {
      ok: true,
      token: decrypt(config.token_encrypted),
      teamId: config.team_id ?? null,
    };
  } catch {
    return {
      ok: false,
      status: 500,
      error: "Couldn't read your stored Vercel token. Reconnect it in Settings.",
    };
  }
}
