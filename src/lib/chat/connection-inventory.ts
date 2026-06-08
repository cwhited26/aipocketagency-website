// connection-inventory.ts — the runtime snapshot of what THIS user's Pocket Agent can actually
// reach. The tool-aware system prompt (system-prompt.ts) enumerates only what's live here, and
// the tool dispatcher (tools.ts) refuses any tool whose connector isn't present — so the agent
// never advertises (or attempts) a Connection the owner hasn't connected.
//
// All connector grants (Gmail / Calendar / Slack / Zoom) share the pa_connections table keyed by a
// `provider` column, so one query covers them. The brain repo + its GitHub token come from the
// pocket_agent_users row; persona names from the personas table. Service-role REST, no SDK.

import { fetchPaUser } from "@/lib/pa-supabase";

// Connectors this lane knows how to drive inline (read) or stage (write). Stripe/QuickBooks are
// owned by their own dispatch lanes and intentionally excluded here. Zoom is in-process (registry),
// so the chat surfaces its reads + create_meeting alongside the meeting-drafting composition.
export const CHAT_CONNECTORS = ["gmail", "calendar", "slack", "zoom"] as const;
export type ChatConnector = (typeof CHAT_CONNECTORS)[number];

export type LiveConnector = {
  provider: ChatConnector;
  // Workspace / account label for the prompt ("connected as chase@…"), when known.
  accountLabel: string | null;
  // Scopes the owner actually granted on this connection's OAuth row. Drives the
  // "needs re-auth" annotation when an action requires a scope not present here.
  // Empty when the row predates scope tracking (treated as "unknown", not "denied").
  scopes: string[];
  // The connection is present (token on file) but flagged status='error' — a token
  // refresh or sync hit an auth hiccup. We STILL surface its tools: reads/drafts
  // self-heal on a good refresh, and a truly dead grant relays a reconnect hint at
  // call time. Hiding it (the old status=active filter) was the Gmail-not-surfacing bug.
  needsReauth: boolean;
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

type ConnectionRow = {
  provider: string;
  email: string | null;
  status: string;
  scopes: string[] | null;
  access_token: string | null;
};
type PersonaRow = { name: string };

/**
 * Connector grants for the user that the agent can actually drive, restricted to the
 * connectors this lane knows.
 *
 * A connection surfaces when it has a token on file (`access_token` present) and isn't
 * revoked — REGARDLESS of `status` or which scopes were granted. This is deliberate: the
 * old `status=eq.active` filter hid any Gmail connection the cron had flagged 'error'
 * (e.g. a refresh-token hiccup, or a grant predating the incremental gmail.send scope),
 * so the agent reported "I don't have a Gmail integration" while the read path could
 * still reach it. Scope/error state travels on the LiveConnector instead, so the prompt
 * annotates an action that needs a missing scope rather than dropping the whole Connection.
 */
async function fetchLiveConnectors(userId: string): Promise<LiveConnector[]> {
  const env = paEnv();
  if (!env) return [];
  const res = await fetch(
    `${env.url}/rest/v1/pa_connections?user_id=eq.${enc(userId)}&status=neq.revoked&select=provider,email,status,scopes,access_token`,
    { headers: { apikey: env.key, Authorization: `Bearer ${env.key}` }, cache: "no-store" },
  );
  if (!res.ok) return [];
  const rows = (await res.json()) as ConnectionRow[];
  const out: LiveConnector[] = [];
  for (const row of rows) {
    if (!isChatConnector(row.provider)) continue;
    // A revoked row wipes its token; require a token so we never advertise a dead grant.
    if (!row.access_token) continue;
    out.push({
      provider: row.provider,
      accountLabel: row.email,
      scopes: Array.isArray(row.scopes) ? row.scopes : [],
      needsReauth: row.status === "error",
    });
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
