// db.ts — data layer for pa_agent_builds (migration 101). Service-role REST against PostgREST,
// no SDK — same posture as pa-inbox-items.ts. RLS lets owners SELECT their own rows; every
// mutation here is scoped by owner_id and the calling routes enforce the ownership gate.

import type { AgentBuildRow, AgentBuildStatus } from "./types";

type PaResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

const TABLE = "pa_agent_builds";

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

export async function createAgentBuild(params: {
  ownerId: string;
  workspaceId: string | null;
  specText: string;
}): Promise<PaResult<AgentBuildRow>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(`${env.url}/rest/v1/${TABLE}`, {
    method: "POST",
    headers: {
      ...authHeaders(env.key),
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      owner_id: params.ownerId,
      workspace_id: params.workspaceId,
      spec_text: params.specText,
      status: "draft",
    }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as AgentBuildRow[];
  if (!rows[0]) return { ok: false, status: 500, error: "No row returned after insert." };
  return { ok: true, data: rows[0] };
}

export async function updateAgentBuild(params: {
  id: string;
  ownerId: string;
  patch: Partial<{
    parsed_intent: Record<string, unknown>;
    composed_persona_slug: string;
    composed_apps: string[];
    composed_skill_slugs: string[];
    composed_brain_scopes: string[];
    status: AgentBuildStatus;
    approval_inbox_item_id: string;
  }>;
}): Promise<PaResult<AgentBuildRow>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(params.id)}&owner_id=eq.${encodeURIComponent(params.ownerId)}`,
    {
      method: "PATCH",
      headers: {
        ...authHeaders(env.key),
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ ...params.patch, updated_at: new Date().toISOString() }),
      cache: "no-store",
    },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as AgentBuildRow[];
  if (!rows[0]) return { ok: false, status: 404, error: "Agent build not found." };
  return { ok: true, data: rows[0] };
}

export async function fetchAgentBuildById(params: {
  id: string;
  ownerId: string;
}): Promise<PaResult<AgentBuildRow | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(params.id)}&owner_id=eq.${encodeURIComponent(params.ownerId)}&limit=1`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as AgentBuildRow[];
  return { ok: true, data: rows[0] ?? null };
}

/** Recent builds for the App surface (newest first, capped). */
export async function listAgentBuilds(ownerId: string): Promise<PaResult<AgentBuildRow[]>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?owner_id=eq.${encodeURIComponent(ownerId)}&order=created_at.desc&limit=20`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) {
    const body = await res.text();
    // Unapplied migration → degrade to an empty list (same posture as pa-inbox-items).
    if (res.status === 404 && (body.includes("PGRST205") || body.includes(TABLE))) {
      return { ok: true, data: [] };
    }
    return { ok: false, status: res.status, error: body };
  }
  const rows = (await res.json()) as AgentBuildRow[];
  return { ok: true, data: rows };
}
