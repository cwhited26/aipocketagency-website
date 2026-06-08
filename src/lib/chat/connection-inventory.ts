// connection-inventory.ts — the runtime snapshot of what THIS user's Pocket Agent can actually
// reach. The tool-aware system prompt (system-prompt.ts) enumerates only what's live here, and
// the tool dispatcher (tools.ts) refuses any tool whose connector isn't present — so the agent
// never advertises (or attempts) a Connection the owner hasn't connected.
//
// All connector grants (Gmail / Calendar / Slack) share the pa_connections table keyed by a
// `provider` column, so one query covers them. The brain repo + its GitHub token come from the
// pocket_agent_users row; persona names from the personas table. Service-role REST, no SDK.

import { fetchPaUser } from "@/lib/pa-supabase";

// Connectors this lane knows how to drive inline (read) or stage (write). Stripe/QuickBooks are
// owned by their own dispatch lanes and intentionally excluded here.
export const CHAT_CONNECTORS = ["gmail", "calendar", "slack"] as const;
export type ChatConnector = (typeof CHAT_CONNECTORS)[number];

export type LiveConnector = {
  provider: ChatConnector;
  // Workspace / account label for the prompt ("connected as chase@…"), when known.
  accountLabel: string | null;
};

export type ChatInventory = {
  connectors: LiveConnector[];
  brainRepo: string | null;
  // GitHub token for the brain repo reads (may be null on a public repo / unconnected brain).
  brainToken: string | null;
  // The Anthropic key used as the PA-managed key for the LLM dispatcher (per the dispatcher's
  // own convention). Empty string when the user has no key — the loop then degrades cleanly.
  paManagedKey: string;
  personaNames: string[];
};

function paEnv(): { url: string; key: string } | null {
  const url =
    process.env.POCKET_AGENT_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.WC_ADMIN_SUPABASE_URL;
  const key =
    process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.WC_ADMIN_SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key };
}

const enc = encodeURIComponent;

function isChatConnector(value: string): value is ChatConnector {
  return (CHAT_CONNECTORS as readonly string[]).includes(value);
}

type ConnectionRow = { provider: string; email: string | null; status: string };
type PersonaRow = { name: string };

/** Active connector grants for the user, restricted to the connectors this lane drives. */
async function fetchLiveConnectors(userId: string): Promise<LiveConnector[]> {
  const env = paEnv();
  if (!env) return [];
  const res = await fetch(
    `${env.url}/rest/v1/pa_connections?user_id=eq.${enc(userId)}&status=eq.active&select=provider,email,status`,
    { headers: { apikey: env.key, Authorization: `Bearer ${env.key}` }, cache: "no-store" },
  );
  if (!res.ok) return [];
  const rows = (await res.json()) as ConnectionRow[];
  const out: LiveConnector[] = [];
  for (const row of rows) {
    if (!isChatConnector(row.provider)) continue;
    out.push({ provider: row.provider, accountLabel: row.email });
  }
  // Stable order so the prompt is deterministic.
  return out.sort((a, b) => a.provider.localeCompare(b.provider));
}

/** Active persona names the owner can reach (bounded). */
async function fetchPersonaNames(userId: string): Promise<string[]> {
  const env = paEnv();
  if (!env) return [];
  const res = await fetch(
    `${env.url}/rest/v1/personas?business_id=eq.${enc(userId)}&status=eq.active&select=name&order=name.asc&limit=25`,
    { headers: { apikey: env.key, Authorization: `Bearer ${env.key}` }, cache: "no-store" },
  ).catch(() => null);
  if (!res || !res.ok) return [];
  const rows = (await res.json().catch(() => [])) as PersonaRow[];
  return rows.map((r) => r.name).filter((n): n is string => Boolean(n));
}

/**
 * Build the full inventory for a user. Each source degrades to empty/null independently — a
 * missing personas table or unconnected brain never blocks the connectors (and vice versa).
 */
export async function loadChatInventory(userId: string): Promise<ChatInventory> {
  const [connectors, personaNames, paRes] = await Promise.all([
    fetchLiveConnectors(userId),
    fetchPersonaNames(userId),
    fetchPaUser(userId),
  ]);

  const paUser = paRes.ok ? paRes.data : null;
  return {
    connectors,
    brainRepo: paUser?.brain_repo ?? null,
    brainToken: paUser?.github_token ?? null,
    paManagedKey: paUser?.anthropic_api_key ?? "",
    personaNames,
  };
}

export function hasConnector(inventory: ChatInventory, provider: ChatConnector): boolean {
  return inventory.connectors.some((c) => c.provider === provider);
}
