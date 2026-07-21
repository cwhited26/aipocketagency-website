// db.ts — the service-role data layer for LinkedIn Scout (pa_linkedin_scout_runs /
// pa_linkedin_scout_prospects / pa_linkedin_scout_drafts, migration 111).
//
// Direct PostgREST, no SDK — matches lib/leads/runs.ts and lib/rituals/db.ts. Every function scopes by
// owner_id (defense-in-depth on top of RLS); the routes verify ownership before calling. Upserts pass
// ?on_conflict so a re-shortlist of the same profile, or a re-draft of the same (prospect, kind),
// collapses to one row instead of raising 23505 (project_postgrest_onconflict_gotcha).

import type {
  ConnectionStatus,
  DraftKind,
  EnrichmentSource,
  LinkedinScoutDraft,
  LinkedinScoutProspect,
  LinkedinScoutRun,
  SearchParams,
} from "./types";

type PaResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

const RUNS = "pa_linkedin_scout_runs";
const PROSPECTS = "pa_linkedin_scout_prospects";
const DRAFTS = "pa_linkedin_scout_drafts";

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

/** PostgREST 404 + PGRST205 when the relation is absent — degrade to "empty" until migration 111
 *  lands so the App surface renders pre-apply, matching the rituals/db.ts degrade pattern. */
function isMissingTable(status: number, body: string, table: string): boolean {
  if (status !== 404) return false;
  return body.includes("PGRST205") || body.includes(table) || body.includes("does not exist");
}

// ── Runs ─────────────────────────────────────────────────────────────────────────────

export async function createRun(params: {
  ownerId: string;
  searchParams: SearchParams;
  candidateCount: number;
}): Promise<PaResult<LinkedinScoutRun>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(`${env.url}/rest/v1/${RUNS}`, {
    method: "POST",
    headers: writeHeaders(env.key),
    body: JSON.stringify({
      owner_id: params.ownerId,
      search_params: params.searchParams,
      candidate_count: params.candidateCount,
    }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as LinkedinScoutRun[];
  if (!rows[0]) return { ok: false, status: 500, error: "No run row returned" };
  return { ok: true, data: rows[0] };
}

export async function getRun(id: string, ownerId: string): Promise<PaResult<LinkedinScoutRun | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const endpoint =
    `${env.url}/rest/v1/${RUNS}` +
    `?id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(ownerId)}&limit=1`;
  const res = await fetch(endpoint, { headers: readHeaders(env.key), cache: "no-store" });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as LinkedinScoutRun[];
  return { ok: true, data: rows[0] ?? null };
}

/** Update a run's tallies + realized cost once shortlisting + drafting completes. */
export async function updateRunTotals(
  id: string,
  patch: { shortlistCount?: number; costUsd?: number },
): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const body: Record<string, unknown> = {};
  if (patch.shortlistCount !== undefined) body.shortlist_count = patch.shortlistCount;
  if (patch.costUsd !== undefined) body.cost_usd = patch.costUsd;
  if (Object.keys(body).length === 0) return { ok: true, data: undefined };

  const res = await fetch(`${env.url}/rest/v1/${RUNS}?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { ...writeHeaders(env.key), Prefer: "return=minimal" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}

// ── Prospects ────────────────────────────────────────────────────────────────────────

/** Count an owner's prospects shortlisted since `sinceIso` — the rolling-window read the gate uses. */
export async function countShortlistedSince(
  ownerId: string,
  sinceIso: string,
): Promise<PaResult<number>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${PROSPECTS}` +
      `?owner_id=eq.${encodeURIComponent(ownerId)}&created_at=gte.${encodeURIComponent(sinceIso)}&select=id`,
    { headers: { ...readHeaders(env.key), Prefer: "count=exact" }, cache: "no-store" },
  );
  if (!res.ok) {
    const body = await res.text();
    if (isMissingTable(res.status, body, PROSPECTS)) return { ok: true, data: 0 };
    return { ok: false, status: res.status, error: body };
  }
  const range = res.headers.get("content-range");
  if (range) {
    const parsed = Number(range.split("/")[1]);
    if (Number.isFinite(parsed)) return { ok: true, data: parsed };
  }
  const rows = (await res.json()) as unknown[];
  return { ok: true, data: Array.isArray(rows) ? rows.length : 0 };
}

/** Insert (or find, on the owner+url unique index) one prospect. Upsert with merge-duplicates so a
 *  re-shortlist of the same profile updates fit/brief rather than raising 23505. */
export async function upsertProspect(params: {
  runId: string;
  ownerId: string;
  linkedinProfileUrl: string;
  fullName: string;
  headline: string;
  company: string;
  fitScore: number;
  enrichmentSource: EnrichmentSource;
  enrichmentSnapshot: Record<string, unknown>;
}): Promise<PaResult<LinkedinScoutProspect>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${PROSPECTS}?on_conflict=owner_id,linkedin_profile_url`,
    {
      method: "POST",
      headers: { ...writeHeaders(env.key), Prefer: "return=representation,resolution=merge-duplicates" },
      body: JSON.stringify({
        run_id: params.runId,
        owner_id: params.ownerId,
        linkedin_profile_url: params.linkedinProfileUrl,
        full_name: params.fullName,
        headline: params.headline,
        company: params.company,
        fit_score: params.fitScore,
        enrichment_source: params.enrichmentSource,
        enrichment_snapshot: params.enrichmentSnapshot,
        updated_at: new Date().toISOString(),
      }),
      cache: "no-store",
    },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as LinkedinScoutProspect[];
  if (!rows[0]) return { ok: false, status: 500, error: "No prospect row returned" };
  return { ok: true, data: rows[0] };
}

export async function getProspect(
  id: string,
  ownerId: string,
): Promise<PaResult<LinkedinScoutProspect | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const endpoint =
    `${env.url}/rest/v1/${PROSPECTS}` +
    `?id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(ownerId)}&limit=1`;
  const res = await fetch(endpoint, { headers: readHeaders(env.key), cache: "no-store" });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as LinkedinScoutProspect[];
  return { ok: true, data: rows[0] ?? null };
}

/** List an owner's prospects, newest first, optionally filtered by connection_status. Degrades to []
 *  until migration 111 lands. */
export async function listProspects(
  ownerId: string,
  filter?: { status?: ConnectionStatus; runId?: string },
): Promise<PaResult<LinkedinScoutProspect[]>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  let endpoint =
    `${env.url}/rest/v1/${PROSPECTS}` +
    `?owner_id=eq.${encodeURIComponent(ownerId)}&order=created_at.desc&limit=500`;
  if (filter?.status) endpoint += `&connection_status=eq.${encodeURIComponent(filter.status)}`;
  if (filter?.runId) endpoint += `&run_id=eq.${encodeURIComponent(filter.runId)}`;

  const res = await fetch(endpoint, { headers: readHeaders(env.key), cache: "no-store" });
  if (!res.ok) {
    const body = await res.text();
    if (isMissingTable(res.status, body, PROSPECTS)) return { ok: true, data: [] };
    return { ok: false, status: res.status, error: body };
  }
  return { ok: true, data: (await res.json()) as LinkedinScoutProspect[] };
}

/** Patch a prospect's research/lifecycle fields (brief after research; connection status on send). */
export async function updateProspect(
  id: string,
  ownerId: string,
  patch: Partial<{
    brief: string;
    connectionStatus: ConnectionStatus;
    connectionSentAt: string | null;
    connectionAcceptedAt: string | null;
    day3InmailStatus: string;
    day7FollowupStatus: string;
    metadata: Record<string, unknown>;
  }>,
): Promise<PaResult<LinkedinScoutProspect>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const body: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.brief !== undefined) body.brief = patch.brief;
  if (patch.connectionStatus !== undefined) body.connection_status = patch.connectionStatus;
  if (patch.connectionSentAt !== undefined) body.connection_sent_at = patch.connectionSentAt;
  if (patch.connectionAcceptedAt !== undefined) body.connection_accepted_at = patch.connectionAcceptedAt;
  if (patch.day3InmailStatus !== undefined) body.day3_inmail_status = patch.day3InmailStatus;
  if (patch.day7FollowupStatus !== undefined) body.day7_followup_status = patch.day7FollowupStatus;
  if (patch.metadata !== undefined) body.metadata = patch.metadata;

  const res = await fetch(
    `${env.url}/rest/v1/${PROSPECTS}?id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(ownerId)}`,
    { method: "PATCH", headers: writeHeaders(env.key), body: JSON.stringify(body), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as LinkedinScoutProspect[];
  if (!rows[0]) return { ok: false, status: 404, error: "Prospect not found" };
  return { ok: true, data: rows[0] };
}

// ── Drafts ───────────────────────────────────────────────────────────────────────────

/** Upsert one draft (on the prospect+kind unique index), so a re-draft replaces the row. Returns the
 *  stored row; the caller links the Approval Queue card id after staging it. */
export async function upsertDraft(params: {
  prospectId: string;
  ownerId: string;
  kind: DraftKind;
  body: string;
  voiceFlags: string;
}): Promise<PaResult<LinkedinScoutDraft>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(`${env.url}/rest/v1/${DRAFTS}?on_conflict=prospect_id,kind`, {
    method: "POST",
    headers: { ...writeHeaders(env.key), Prefer: "return=representation,resolution=merge-duplicates" },
    body: JSON.stringify({
      prospect_id: params.prospectId,
      owner_id: params.ownerId,
      kind: params.kind,
      body: params.body,
      voice_flags: params.voiceFlags,
    }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as LinkedinScoutDraft[];
  if (!rows[0]) return { ok: false, status: 500, error: "No draft row returned" };
  return { ok: true, data: rows[0] };
}

/** Point a draft at its staged Approval Queue card (pa_inbox_items row). */
export async function linkDraftPendingAction(
  draftId: string,
  inboxItemId: string,
): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(`${env.url}/rest/v1/${DRAFTS}?id=eq.${encodeURIComponent(draftId)}`, {
    method: "PATCH",
    headers: { ...writeHeaders(env.key), Prefer: "return=minimal" },
    body: JSON.stringify({ agent_pending_action_id: inboxItemId }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}

/** Stamp a draft executed_at once its send has been dispatched (or staged as receiver-missing). */
export async function markDraftExecuted(draftId: string): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(`${env.url}/rest/v1/${DRAFTS}?id=eq.${encodeURIComponent(draftId)}`, {
    method: "PATCH",
    headers: { ...writeHeaders(env.key), Prefer: "return=minimal" },
    body: JSON.stringify({ executed_at: new Date().toISOString() }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}

/** A prospect's drafts (all three kinds), for the Prospects tab's expanded row + the execute route. */
export async function listDraftsForProspect(
  prospectId: string,
  ownerId: string,
): Promise<PaResult<LinkedinScoutDraft[]>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const endpoint =
    `${env.url}/rest/v1/${DRAFTS}` +
    `?prospect_id=eq.${encodeURIComponent(prospectId)}&owner_id=eq.${encodeURIComponent(ownerId)}` +
    `&order=created_at.asc`;
  const res = await fetch(endpoint, { headers: readHeaders(env.key), cache: "no-store" });
  if (!res.ok) {
    const body = await res.text();
    if (isMissingTable(res.status, body, DRAFTS)) return { ok: true, data: [] };
    return { ok: false, status: res.status, error: body };
  }
  return { ok: true, data: (await res.json()) as LinkedinScoutDraft[] };
}

/** All drafts for a set of prospects — batched read for the Prospects tab so the page makes one call
 *  instead of one per prospect. */
export async function listDraftsForOwner(
  ownerId: string,
): Promise<PaResult<LinkedinScoutDraft[]>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const endpoint =
    `${env.url}/rest/v1/${DRAFTS}` +
    `?owner_id=eq.${encodeURIComponent(ownerId)}&order=created_at.desc&limit=1500`;
  const res = await fetch(endpoint, { headers: readHeaders(env.key), cache: "no-store" });
  if (!res.ok) {
    const body = await res.text();
    if (isMissingTable(res.status, body, DRAFTS)) return { ok: true, data: [] };
    return { ok: false, status: res.status, error: body };
  }
  return { ok: true, data: (await res.json()) as LinkedinScoutDraft[] };
}
