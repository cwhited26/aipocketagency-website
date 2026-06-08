// runs.ts — data layer for Lead Scout runs + leads (pa_lead_scout_runs / pa_lead_scout_leads).
//
// Service-role PostgREST, scoped by owner_id, matching pa-projects.ts / pa-inbox-items.ts. The
// orchestrator (scout.ts) creates a run, inserts a lead per URL as it processes, then completes the
// run with the tally; the API routes read runs + leads back for the run page and the CSV download.

import type {
  ConfigWarning,
  LeadBreakdown,
  LeadClassification,
  LeadScoutLead,
  LeadScoutRun,
} from "./types";

type PaResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

function paEnv(): { url: string; key: string } | { error: string } {
  const url =
    process.env.POCKET_AGENT_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.WC_ADMIN_SUPABASE_URL;
  const key =
    process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.WC_ADMIN_SUPABASE_SERVICE_KEY;
  if (!url || !key) return { error: "Supabase env vars not set" };
  return { url: url.replace(/\/$/, ""), key };
}

function readHeaders(key: string): Record<string, string> {
  return { apikey: key, Authorization: `Bearer ${key}` };
}
function writeHeaders(key: string): Record<string, string> {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

// ── Runs ────────────────────────────────────────────────────────────────────

export async function createRun(params: {
  sourceId: string;
  ownerId: string;
  urlCount: number;
  configWarnings: ConfigWarning[];
}): Promise<PaResult<LeadScoutRun>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(`${env.url}/rest/v1/pa_lead_scout_runs`, {
    method: "POST",
    headers: writeHeaders(env.key),
    body: JSON.stringify({
      source_id: params.sourceId,
      owner_id: params.ownerId,
      status: "running",
      url_count: params.urlCount,
      config_warnings: params.configWarnings,
      started_at: new Date().toISOString(),
    }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as LeadScoutRun[];
  if (!rows[0]) return { ok: false, status: 500, error: "No run row returned" };
  return { ok: true, data: rows[0] };
}

export async function finishRun(params: {
  runId: string;
  status: "completed" | "failed";
  leadCount: number;
  breakdown: LeadBreakdown;
  error?: string | null;
}): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/pa_lead_scout_runs?id=eq.${encodeURIComponent(params.runId)}`,
    {
      method: "PATCH",
      headers: { ...writeHeaders(env.key), Prefer: "return=minimal" },
      body: JSON.stringify({
        status: params.status,
        lead_count: params.leadCount,
        breakdown: params.breakdown,
        error: params.error ?? null,
        completed_at: new Date().toISOString(),
      }),
      cache: "no-store",
    },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}

export async function getRun(id: string, ownerId: string): Promise<PaResult<LeadScoutRun | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const endpoint =
    `${env.url}/rest/v1/pa_lead_scout_runs` +
    `?id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(ownerId)}&limit=1`;
  const res = await fetch(endpoint, { headers: readHeaders(env.key), cache: "no-store" });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as LeadScoutRun[];
  return { ok: true, data: rows[0] ?? null };
}

export async function listRunsForSource(
  sourceId: string,
  ownerId: string,
): Promise<PaResult<LeadScoutRun[]>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const endpoint =
    `${env.url}/rest/v1/pa_lead_scout_runs` +
    `?source_id=eq.${encodeURIComponent(sourceId)}&owner_id=eq.${encodeURIComponent(ownerId)}` +
    `&order=created_at.desc&limit=50`;
  const res = await fetch(endpoint, { headers: readHeaders(env.key), cache: "no-store" });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: (await res.json()) as LeadScoutRun[] };
}

// ── Leads ───────────────────────────────────────────────────────────────────

export async function insertLead(params: {
  runId: string;
  sourceId: string;
  ownerId: string;
  url: string;
  domain: string;
  name: string;
  contact: string;
  summary: string;
  profile: Record<string, unknown>;
  classification: LeadClassification;
  brainPath: string | null;
  status: "extracted" | "failed";
  error: string | null;
}): Promise<PaResult<LeadScoutLead>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(`${env.url}/rest/v1/pa_lead_scout_leads`, {
    method: "POST",
    headers: writeHeaders(env.key),
    body: JSON.stringify({
      run_id: params.runId,
      source_id: params.sourceId,
      owner_id: params.ownerId,
      url: params.url,
      domain: params.domain,
      name: params.name,
      contact: params.contact,
      summary: params.summary,
      profile: params.profile,
      classification: params.classification,
      brain_path: params.brainPath,
      status: params.status,
      error: params.error,
    }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as LeadScoutLead[];
  if (!rows[0]) return { ok: false, status: 500, error: "No lead row returned" };
  return { ok: true, data: rows[0] };
}

export async function listLeadsForRun(
  runId: string,
  ownerId: string,
): Promise<PaResult<LeadScoutLead[]>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const endpoint =
    `${env.url}/rest/v1/pa_lead_scout_leads` +
    `?run_id=eq.${encodeURIComponent(runId)}&owner_id=eq.${encodeURIComponent(ownerId)}` +
    `&order=created_at.asc&limit=2000`;
  const res = await fetch(endpoint, { headers: readHeaders(env.key), cache: "no-store" });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: (await res.json()) as LeadScoutLead[] };
}
