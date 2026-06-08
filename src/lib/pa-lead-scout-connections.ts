// pa-lead-scout-connections.ts — the Bright Data key connection for Lead Scout.
//
// Unlike the OAuth connectors (Gmail, Calendar, Slack…), Lead Scout doesn't do OAuth — the owner
// pastes their Bright Data API key once. We store it AES-256-GCM encrypted (lib/crypto/encrypt.ts,
// key GMAIL_TOKEN_ENCRYPTION_KEY) inside pa_connections.config jsonb rather than in a refresh-token
// column, because there's no token to refresh — just one long-lived key.
//
// Studio+ / Enterprise owners can instead flip `use_shared` and run through PA's platform Bright
// Data account (BRIGHT_DATA_API_KEY on the server) — no key of their own required. resolveBrightData
// is the single read the scout orchestrator calls to get the actual key to use, owner-or-shared.
//
// All writes use the service-role key; RLS lets the owner SELECT their own row (the config blob is
// only ever returned to the UI via fetchLeadScoutConnectionPublic, which strips the ciphertext).

import { encrypt, decrypt } from "@/lib/crypto/encrypt";
import { getCurrentTier, tierRank, type Tier } from "@/lib/personas/tier-caps";

export const LEAD_SCOUT_PROVIDER = "lead_scout" as const;

// Shared-account perk unlocks at Studio and above (Studio / Studio+ / Enterprise).
const SHARED_ACCOUNT_MIN_TIER: Tier = "studio";

export function tierAllowsSharedBrightData(tier: Tier): boolean {
  return tierRank(tier) >= tierRank(SHARED_ACCOUNT_MIN_TIER);
}

type LeadScoutConfig = {
  api_key_encrypted?: string;
  use_shared?: boolean;
};

type PaResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

/** The non-secret view the Connections card renders — never the ciphertext. */
export type LeadScoutConnectionPublic = {
  status: "active" | "revoked" | "error";
  /** True when the owner pasted their own key. */
  hasOwnKey: boolean;
  /** True when the owner opted into PA's shared Bright Data account. */
  useShared: boolean;
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
  config: LeadScoutConfig | null;
};

async function fetchRow(userId: string): Promise<PaResult<ConnectionRow | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const endpoint =
    `${env.url}/rest/v1/pa_connections` +
    `?user_id=eq.${encodeURIComponent(userId)}&provider=eq.${LEAD_SCOUT_PROVIDER}` +
    `&select=status,config&limit=1`;
  const res = await fetch(endpoint, { headers: authHeaders(env.key), cache: "no-store" });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as ConnectionRow[];
  return { ok: true, data: rows[0] ?? null };
}

/** Public, ciphertext-free view for the Connections settings card. */
export async function fetchLeadScoutConnectionPublic(
  userId: string,
): Promise<PaResult<LeadScoutConnectionPublic | null>> {
  const row = await fetchRow(userId);
  if (!row.ok) return row;
  if (!row.data) return { ok: true, data: null };
  const config = row.data.config ?? {};
  return {
    ok: true,
    data: {
      status: row.data.status,
      hasOwnKey: Boolean(config.api_key_encrypted),
      useShared: Boolean(config.use_shared),
    },
  };
}

/**
 * Store (or update) the owner's Bright Data connection. Either a pasted key (encrypted into the
 * config blob) or the shared-account opt-in. Upserts the single row per (user, provider).
 */
export async function storeLeadScoutConnection(params: {
  userId: string;
  apiKey: string | null;
  useShared: boolean;
}): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const config: LeadScoutConfig = { use_shared: params.useShared };
  if (params.apiKey) config.api_key_encrypted = encrypt(params.apiKey);

  const body = {
    user_id: params.userId,
    provider: LEAD_SCOUT_PROVIDER,
    email: "Bright Data",
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

/** Disconnect — flip the row to revoked and clear the stored key from config. */
export async function disconnectLeadScoutConnection(userId: string): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const endpoint =
    `${env.url}/rest/v1/pa_connections` +
    `?user_id=eq.${encodeURIComponent(userId)}&provider=eq.${LEAD_SCOUT_PROVIDER}`;
  const res = await fetch(endpoint, {
    method: "PATCH",
    headers: { ...authHeaders(env.key), "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ status: "revoked", config: {}, updated_at: new Date().toISOString() }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}

export type ResolvedBrightData =
  | { ok: true; apiKey: string; source: "owner" | "shared" }
  | { ok: false; status: number; error: string };

/**
 * The single read the scout orchestrator makes to get the Bright Data key to actually use:
 *   • use_shared (Studio+ only) → the platform key BRIGHT_DATA_API_KEY, gated by tier.
 *   • otherwise → the owner's own decrypted key from config.
 * Returns a typed error (never throws) so the run records a clean failure instead of crashing.
 */
export async function resolveBrightData(userId: string): Promise<ResolvedBrightData> {
  const row = await fetchRow(userId);
  if (!row.ok) return { ok: false, status: row.status, error: row.error };
  if (!row.data || row.data.status !== "active") {
    return {
      ok: false,
      status: 409,
      error: "Connect Bright Data in Settings → Connections → Lead Scout before running a source.",
    };
  }

  const config = row.data.config ?? {};

  if (config.use_shared) {
    const tier = await getCurrentTier(userId);
    if (!tierAllowsSharedBrightData(tier)) {
      return {
        ok: false,
        status: 403,
        error: "The shared Bright Data account is a Studio+ perk. Paste your own key or upgrade.",
      };
    }
    const platformKey = process.env.BRIGHT_DATA_API_KEY;
    if (!platformKey) {
      return {
        ok: false,
        status: 503,
        error: "PA's shared Bright Data account isn't configured yet. Paste your own key for now.",
      };
    }
    return { ok: true, apiKey: platformKey, source: "shared" };
  }

  if (!config.api_key_encrypted) {
    return {
      ok: false,
      status: 409,
      error: "No Bright Data key on file. Add one in Settings → Connections → Lead Scout.",
    };
  }
  try {
    return { ok: true, apiKey: decrypt(config.api_key_encrypted), source: "owner" };
  } catch {
    return {
      ok: false,
      status: 500,
      error: "Couldn't read your stored Bright Data key. Reconnect it in Settings.",
    };
  }
}
