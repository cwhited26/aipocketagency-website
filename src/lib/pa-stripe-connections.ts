/**
 * Data layer for the owner's Stripe Connect connection (pa_connections, provider='stripe_connect').
 * Service-role REST only — no SDK, plain fetch against the Supabase REST API, mirroring
 * pa-calendar-connections.ts / pa-slack-connections.ts.
 *
 * This is the OWNER's business Stripe account (connected via Stripe Connect), NOT PA's platform
 * Stripe. The two never share a row — provider='stripe_connect' keeps them distinct (migration
 * 029). PA's platform billing lives entirely outside pa_connections.
 *
 * Storage model:
 *   • refresh_token_encrypted — the Connect refresh token (rt_…), AES-256-GCM via
 *     lib/crypto/encrypt.ts. Connected-account API calls authenticate with the PLATFORM secret
 *     key + a Stripe-Account header (see lib/connectors/stripe/api.ts), so the refresh token is
 *     stored for token-model completeness + future per-account minting, not used on every call.
 *   • stripe_account_id — the connected account id (acct_…). Not a secret; its own column.
 *   • email column is REPURPOSED to store the connected account's business display name for the
 *     Connections card (pa_connections has no provider-metadata column). Documented here so the
 *     repurpose is explicit, same as the Slack workspace-name repurpose.
 */

export type StripeConnectionStatus = "active" | "revoked" | "error";

export type StripeConnectionPublic = {
  id: string;
  user_id: string;
  provider: "stripe_connect";
  /** Business display name of the connected account — stored in the shared `email` column. */
  businessName: string | null;
  stripeAccountId: string | null;
  scopes: string[] | null;
  status: StripeConnectionStatus;
  created_at: string;
  updated_at: string;
};

export type StripeConnectionFull = StripeConnectionPublic & {
  refresh_token_encrypted: string | null;
};

type PaResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

const TABLE = "pa_connections";
const PROVIDER = "stripe_connect";

const PUBLIC_FIELDS =
  "id,user_id,provider,email,stripe_account_id,scopes,status,created_at,updated_at";
const FULL_FIELDS = `${PUBLIC_FIELDS},refresh_token_encrypted`;

// The PostgREST row shape (email is the raw column; exposed as `businessName`).
type StripeRow = {
  id: string;
  user_id: string;
  provider: "stripe_connect";
  email: string | null;
  stripe_account_id: string | null;
  scopes: string[] | null;
  status: StripeConnectionStatus;
  created_at: string;
  updated_at: string;
  refresh_token_encrypted?: string | null;
};

function toPublic(row: StripeRow): StripeConnectionPublic {
  return {
    id: row.id,
    user_id: row.user_id,
    provider: "stripe_connect",
    businessName: row.email,
    stripeAccountId: row.stripe_account_id,
    scopes: row.scopes,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toFull(row: StripeRow): StripeConnectionFull {
  return { ...toPublic(row), refresh_token_encrypted: row.refresh_token_encrypted ?? null };
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

export async function fetchStripeConnectionPublic(
  userId: string,
): Promise<PaResult<StripeConnectionPublic | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?user_id=eq.${encodeURIComponent(userId)}&provider=eq.${PROVIDER}&select=${PUBLIC_FIELDS}&limit=1`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as StripeRow[];
  return { ok: true, data: rows[0] ? toPublic(rows[0]) : null };
}

export async function fetchStripeConnectionFull(
  userId: string,
): Promise<PaResult<StripeConnectionFull | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?user_id=eq.${encodeURIComponent(userId)}&provider=eq.${PROVIDER}&select=${FULL_FIELDS}&limit=1`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as StripeRow[];
  return { ok: true, data: rows[0] ? toFull(rows[0]) : null };
}

// ─── Writes (service-role) ────────────────────────────────────────────────────

export type UpsertStripeConnectionData = {
  userId: string;
  businessName: string | null;
  stripeAccountId: string;
  refreshTokenEncrypted: string | null;
  scopes: string[];
};

export async function upsertStripeConnection(
  data: UpsertStripeConnectionData,
): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const now = new Date().toISOString();
  const body: Record<string, unknown> = {
    user_id: data.userId,
    provider: PROVIDER,
    email: data.businessName,
    stripe_account_id: data.stripeAccountId,
    scopes: data.scopes,
    status: "active",
    updated_at: now,
  };
  // Stripe returns a refresh token on every successful Connect grant; persist it when present.
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

/** Mark a connection broken so write actions stop firing against a deauthorized account. */
export async function markStripeConnectionError(id: string): Promise<PaResult<void>> {
  return patchById(id, { status: "error", updated_at: new Date().toISOString() });
}

/** Soft-delete on disconnect: revoke status + wipe the token. Row retained for history. */
export async function revokeStripeConnection(userId: string): Promise<PaResult<void>> {
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
