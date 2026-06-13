// pa-moonchild-connections.ts — BYO Moonchild connection store (pa_connections, provider='moonchild').
//
// Owners bring their own msk_* token from studio.moonchild.ai → Settings → Integrations →
// Moonchild MCP → Connect → Tool: Claude Code → Generate → Copy. That token is stored
// AES-256-GCM encrypted in pa_connections.config (same pattern as the Vercel connector).
//
// Note: pa_llm_provider_settings has user_id UUID PRIMARY KEY (one row per user total),
// so it can't hold a second provider alongside an existing Anthropic/OpenAI key. pa_connections
// uses UNIQUE(user_id, provider) — the correct home for per-owner per-provider tokens. (PA-LPB-13)
//
// config shape: { token_encrypted: "v1.…", mcp_url?: "https://forge.moonchild.ai/mcp", account_label?: "…" }
//   • mcp_url: the owner's personal MCP endpoint. Defaults to the public endpoint when absent.
//   • account_label: display label from connect-time, shown on the Connections card.

import { encrypt, decrypt } from "@/lib/crypto/encrypt";

export const MOONCHILD_PROVIDER = "moonchild" as const;
export const DEFAULT_MOONCHILD_MCP_URL = "https://forge.moonchild.ai/mcp";

type MoonchildConfig = {
  token_encrypted?: string;
  mcp_url?: string;
  account_label?: string;
};

type PaResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

export type MoonchildConnectionPublic = {
  status: "active" | "revoked" | "error";
  hasToken: boolean;
  mcpUrl: string;
  accountLabel: string | null;
};

export type ResolvedMoonchildToken = { ok: true; token: string; mcpUrl: string } | { ok: false; status: number; error: string };

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
  config: MoonchildConfig | null;
};

async function fetchRow(userId: string): Promise<PaResult<ConnectionRow | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const endpoint =
    `${env.url}/rest/v1/pa_connections` +
    `?user_id=eq.${encodeURIComponent(userId)}&provider=eq.${MOONCHILD_PROVIDER}` +
    `&select=status,config&limit=1`;
  const res = await fetch(endpoint, { headers: authHeaders(env.key), cache: "no-store" });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as ConnectionRow[];
  return { ok: true, data: rows[0] ?? null };
}

export async function fetchMoonchildConnectionPublic(
  userId: string,
): Promise<PaResult<MoonchildConnectionPublic | null>> {
  const row = await fetchRow(userId);
  if (!row.ok) return row;
  if (!row.data) return { ok: true, data: null };
  const config = row.data.config ?? {};
  return {
    ok: true,
    data: {
      status: row.data.status,
      hasToken: Boolean(config.token_encrypted),
      mcpUrl: config.mcp_url ?? DEFAULT_MOONCHILD_MCP_URL,
      accountLabel: config.account_label ?? null,
    },
  };
}

export async function storeMoonchildConnection(params: {
  userId: string;
  token: string;
  mcpUrl?: string;
  accountLabel?: string;
}): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const config: MoonchildConfig = { token_encrypted: encrypt(params.token) };
  if (params.mcpUrl && params.mcpUrl !== DEFAULT_MOONCHILD_MCP_URL) config.mcp_url = params.mcpUrl;
  if (params.accountLabel) config.account_label = params.accountLabel;

  const body = {
    user_id: params.userId,
    provider: MOONCHILD_PROVIDER,
    email: params.accountLabel ?? "Moonchild",
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

export async function disconnectMoonchildConnection(userId: string): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const endpoint =
    `${env.url}/rest/v1/pa_connections` +
    `?user_id=eq.${encodeURIComponent(userId)}&provider=eq.${MOONCHILD_PROVIDER}`;
  const res = await fetch(endpoint, {
    method: "PATCH",
    headers: { ...authHeaders(env.key), "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ status: "revoked", config: {}, updated_at: new Date().toISOString() }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}

export async function resolveMoonchildToken(userId: string): Promise<ResolvedMoonchildToken> {
  const row = await fetchRow(userId);
  if (!row.ok) return { ok: false, status: row.status, error: row.error };
  if (!row.data || row.data.status === "revoked") {
    return {
      ok: false,
      status: 409,
      error: "Connect your Moonchild account in Settings → Connections before using it here.",
    };
  }
  const config = row.data.config ?? {};
  if (!config.token_encrypted) {
    return {
      ok: false,
      status: 409,
      error: "No Moonchild token on file. Paste your msk_* token in Settings → Connections → Moonchild.",
    };
  }
  try {
    return {
      ok: true,
      token: decrypt(config.token_encrypted),
      mcpUrl: config.mcp_url ?? DEFAULT_MOONCHILD_MCP_URL,
    };
  } catch {
    return {
      ok: false,
      status: 500,
      error: "Couldn't read your stored Moonchild token. Reconnect it in Settings.",
    };
  }
}
