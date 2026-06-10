// store.ts — data layer for the Idea Engine tables (pa_ideas, pa_idea_stage_runs).
//
// Service-role PostgREST scoped by owner_id, matching lib/leads/source.ts and lib/pa-inbox-items.ts.
// RLS lets owners SELECT only their own rows (defense-in-depth); every function here scopes by
// owner_id and the calling routes enforce an ownership gate before mutating. No SDK — plain fetch
// against the Supabase REST API.

import { ideaLog, errMsg } from "./log";
import type { IdeaRow, IdeaSource, IdeaStatus, StageRunRow, StageStatus } from "./types";

export type PaResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

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

const IDEAS = "pa_ideas";
const RUNS = "pa_idea_stage_runs";

// ── pa_ideas ────────────────────────────────────────────────────────────────────────────────────

export async function createIdea(input: {
  ownerId: string;
  slug: string;
  title: string;
  source: IdeaSource;
  sourcePayload: Record<string, unknown>;
  snapshotBrainPath: string;
}): Promise<PaResult<IdeaRow>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  let res: Response;
  try {
    res = await fetch(`${env.url}/rest/v1/${IDEAS}`, {
      method: "POST",
      headers: writeHeaders(env.key),
      body: JSON.stringify({
        owner_id: input.ownerId,
        slug: input.slug,
        title: input.title,
        source: input.source,
        source_payload: input.sourcePayload,
        current_stage: 1,
        status: "active",
        snapshot_brain_path: input.snapshotBrainPath,
      }),
      cache: "no-store",
    });
  } catch (e) {
    ideaLog.error("createIdea network error", { error: errMsg(e) });
    return { ok: false, status: 502, error: "Could not reach the database." };
  }
  if (!res.ok) {
    const body = (await res.text().catch(() => "")).slice(0, 200);
    return { ok: false, status: res.status, error: `Create idea failed: ${body}` };
  }
  const rows = (await res.json()) as IdeaRow[];
  if (!rows[0]) return { ok: false, status: 500, error: "Create idea returned no row." };
  return { ok: true, data: rows[0] };
}

export async function listIdeas(ownerId: string): Promise<PaResult<IdeaRow[]>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  const endpoint =
    `${env.url}/rest/v1/${IDEAS}` +
    `?owner_id=eq.${encodeURIComponent(ownerId)}&order=updated_at.desc&limit=200`;
  let res: Response;
  try {
    res = await fetch(endpoint, { headers: readHeaders(env.key), cache: "no-store" });
  } catch (e) {
    ideaLog.error("listIdeas network error", { error: errMsg(e) });
    return { ok: false, status: 502, error: "Could not reach the database." };
  }
  if (!res.ok) return { ok: false, status: res.status, error: `List ideas failed (${res.status}).` };
  return { ok: true, data: (await res.json()) as IdeaRow[] };
}

async function fetchOneIdea(
  ownerId: string,
  filter: string,
): Promise<PaResult<IdeaRow | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  const endpoint =
    `${env.url}/rest/v1/${IDEAS}?owner_id=eq.${encodeURIComponent(ownerId)}&${filter}&limit=1`;
  let res: Response;
  try {
    res = await fetch(endpoint, { headers: readHeaders(env.key), cache: "no-store" });
  } catch (e) {
    ideaLog.error("fetchOneIdea network error", { error: errMsg(e) });
    return { ok: false, status: 502, error: "Could not reach the database." };
  }
  if (!res.ok) return { ok: false, status: res.status, error: `Fetch idea failed (${res.status}).` };
  const rows = (await res.json()) as IdeaRow[];
  return { ok: true, data: rows[0] ?? null };
}

export function getIdeaBySlug(ownerId: string, slug: string): Promise<PaResult<IdeaRow | null>> {
  return fetchOneIdea(ownerId, `slug=eq.${encodeURIComponent(slug)}`);
}

export function getIdeaById(ownerId: string, id: string): Promise<PaResult<IdeaRow | null>> {
  return fetchOneIdea(ownerId, `id=eq.${encodeURIComponent(id)}`);
}

export async function updateIdea(
  ownerId: string,
  id: string,
  patch: Partial<{ current_stage: number; status: IdeaStatus }>,
): Promise<PaResult<IdeaRow>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  const endpoint =
    `${env.url}/rest/v1/${IDEAS}` +
    `?id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(ownerId)}`;
  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "PATCH",
      headers: writeHeaders(env.key),
      body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
      cache: "no-store",
    });
  } catch (e) {
    ideaLog.error("updateIdea network error", { error: errMsg(e) });
    return { ok: false, status: 502, error: "Could not reach the database." };
  }
  if (!res.ok) return { ok: false, status: res.status, error: `Update idea failed (${res.status}).` };
  const rows = (await res.json()) as IdeaRow[];
  if (!rows[0]) return { ok: false, status: 404, error: "Idea not found." };
  return { ok: true, data: rows[0] };
}

// ── pa_idea_stage_runs ────────────────────────────────────────────────────────────────────────────

export async function createStageRun(input: {
  ideaId: string;
  ownerId: string;
  stage: number;
  status?: StageStatus;
}): Promise<PaResult<StageRunRow>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  let res: Response;
  try {
    res = await fetch(`${env.url}/rest/v1/${RUNS}`, {
      method: "POST",
      headers: writeHeaders(env.key),
      body: JSON.stringify({
        idea_id: input.ideaId,
        owner_id: input.ownerId,
        stage: input.stage,
        status: input.status ?? "running",
        started_at: new Date().toISOString(),
      }),
      cache: "no-store",
    });
  } catch (e) {
    ideaLog.error("createStageRun network error", { error: errMsg(e) });
    return { ok: false, status: 502, error: "Could not reach the database." };
  }
  if (!res.ok) {
    const body = (await res.text().catch(() => "")).slice(0, 200);
    return { ok: false, status: res.status, error: `Create stage run failed: ${body}` };
  }
  const rows = (await res.json()) as StageRunRow[];
  if (!rows[0]) return { ok: false, status: 500, error: "Create stage run returned no row." };
  return { ok: true, data: rows[0] };
}

export async function updateStageRun(
  runId: string,
  patch: Partial<{
    status: StageStatus;
    output: Record<string, unknown>;
    error: string | null;
    completed_at: string | null;
  }>,
): Promise<PaResult<StageRunRow>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  let res: Response;
  try {
    res = await fetch(`${env.url}/rest/v1/${RUNS}?id=eq.${encodeURIComponent(runId)}`, {
      method: "PATCH",
      headers: writeHeaders(env.key),
      body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
      cache: "no-store",
    });
  } catch (e) {
    ideaLog.error("updateStageRun network error", { error: errMsg(e) });
    return { ok: false, status: 502, error: "Could not reach the database." };
  }
  if (!res.ok) return { ok: false, status: res.status, error: `Update stage run failed (${res.status}).` };
  const rows = (await res.json()) as StageRunRow[];
  if (!rows[0]) return { ok: false, status: 404, error: "Stage run not found." };
  return { ok: true, data: rows[0] };
}

/** All stage runs for an idea, newest first — the surface folds these into latest-per-stage. */
export async function listStageRuns(
  ownerId: string,
  ideaId: string,
): Promise<PaResult<StageRunRow[]>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  const endpoint =
    `${env.url}/rest/v1/${RUNS}` +
    `?owner_id=eq.${encodeURIComponent(ownerId)}&idea_id=eq.${encodeURIComponent(ideaId)}` +
    `&order=created_at.desc&limit=300`;
  let res: Response;
  try {
    res = await fetch(endpoint, { headers: readHeaders(env.key), cache: "no-store" });
  } catch (e) {
    ideaLog.error("listStageRuns network error", { error: errMsg(e) });
    return { ok: false, status: 502, error: "Could not reach the database." };
  }
  if (!res.ok) return { ok: false, status: res.status, error: `List stage runs failed (${res.status}).` };
  return { ok: true, data: (await res.json()) as StageRunRow[] };
}

/** Reduce a newest-first run list to the latest run per stage number. Pure (exported for the test). */
export function latestRunsByStage(runs: StageRunRow[]): Map<number, StageRunRow> {
  const map = new Map<number, StageRunRow>();
  // `runs` arrives newest-first; the first row seen for a stage is its latest.
  for (const r of runs) {
    if (!map.has(r.stage)) map.set(r.stage, r);
  }
  return map;
}
