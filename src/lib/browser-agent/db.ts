// db.ts — service-role PostgREST access for pa_browser_jobs / pa_browser_steps (migration 098).
// RLS exposes owner SELECTs only; every write here rides the service role from gated routes or
// the cron worker, always scoped by owner_id / id in the query. Mirrors lib/personas/db.ts.

import type { JobStatus } from "./constants";
import { WORKER_LEASE_SECONDS } from "./constants";
import type { StepActionKind } from "./constants";
import {
  BrowserJobRowSchema,
  BrowserStepRowSchema,
  type BrowserJobRow,
  type BrowserJobState,
  type BrowserStepRow,
  type PendingStep,
} from "./types";

export type DbResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

function env(): { url: string; key: string } | { error: string } {
  const url =
    process.env.POCKET_AGENT_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.WC_ADMIN_SUPABASE_URL;
  const key =
    process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.WC_ADMIN_SUPABASE_SERVICE_KEY;
  if (!url || !key) return { error: "Supabase service-role env not set" };
  return { url: url.replace(/\/$/, ""), key };
}

async function rest<T>(
  pathAndQuery: string,
  init: { method?: string; body?: unknown; prefer?: string } = {},
): Promise<DbResult<T>> {
  const cfg = env();
  if ("error" in cfg) return { ok: false, status: 500, error: cfg.error };

  const headers: Record<string, string> = {
    apikey: cfg.key,
    Authorization: `Bearer ${cfg.key}`,
  };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  if (init.prefer) headers.Prefer = init.prefer;

  const res = await fetch(`${cfg.url}/rest/v1/${pathAndQuery}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, status: res.status, error: body.slice(0, 500) };
  }
  if (res.status === 204) return { ok: true, data: undefined as T };
  const data = (await res.json()) as T;
  return { ok: true, data };
}

function parseJobRows(rows: unknown[]): BrowserJobRow[] {
  const out: BrowserJobRow[] = [];
  for (const row of rows) {
    const parsed = BrowserJobRowSchema.safeParse(row);
    if (parsed.success) out.push(parsed.data);
    else {
      console.warn("[browser-agent/db] job row failed to parse", {
        issue: parsed.error.issues[0]?.message ?? "shape mismatch",
      });
    }
  }
  return out;
}

// ── Jobs ─────────────────────────────────────────────────────────────────────────────────

export async function insertBrowserJob(params: {
  ownerId: string;
  agentPersonaId: string | null;
  intent: string;
  startingUrl: string;
  maxSteps: number;
  maxWallSeconds: number;
  maxCostMicroCents: number;
  gateFindings: unknown | null;
  entitlementSource: "tier" | "project_pass";
}): Promise<DbResult<BrowserJobRow>> {
  const res = await rest<unknown[]>("pa_browser_jobs", {
    method: "POST",
    prefer: "return=representation",
    body: {
      owner_id: params.ownerId,
      agent_persona_id: params.agentPersonaId,
      intent: params.intent,
      starting_url: params.startingUrl,
      max_steps: params.maxSteps,
      max_wall_seconds: params.maxWallSeconds,
      max_cost_micro_cents: params.maxCostMicroCents,
      gate_findings: params.gateFindings,
      entitlement_source: params.entitlementSource,
      status: "queued",
    },
  });
  if (!res.ok) return res;
  const rows = parseJobRows(res.data);
  if (!rows[0]) return { ok: false, status: 500, error: "No row returned after insert." };
  return { ok: true, data: rows[0] };
}

export async function fetchBrowserJob(params: {
  jobId: string;
  ownerId?: string;
}): Promise<DbResult<BrowserJobRow | null>> {
  const ownerFilter = params.ownerId ? `&owner_id=eq.${params.ownerId}` : "";
  const res = await rest<unknown[]>(
    `pa_browser_jobs?id=eq.${params.jobId}${ownerFilter}&limit=1`,
  );
  if (!res.ok) return res;
  const rows = parseJobRows(res.data);
  return { ok: true, data: rows[0] ?? null };
}

export async function listBrowserJobs(ownerId: string, limit = 50): Promise<DbResult<BrowserJobRow[]>> {
  const res = await rest<unknown[]>(
    `pa_browser_jobs?owner_id=eq.${ownerId}&order=created_at.desc&limit=${limit}`,
  );
  if (!res.ok) return res;
  return { ok: true, data: parseJobRows(res.data) };
}

export type JobPatch = Partial<{
  status: JobStatus;
  current_step: number;
  cost_micro_cents_estimate: number;
  state_json: BrowserJobState;
  browserbase_session_id: string | null;
  pending_step: PendingStep | null;
  result_summary: string | null;
  error: string | null;
  lease_until: string | null;
  started_at: string | null;
  completed_at: string | null;
}>;

export async function updateBrowserJob(jobId: string, patch: JobPatch): Promise<DbResult<undefined>> {
  return rest<undefined>(`pa_browser_jobs?id=eq.${jobId}`, {
    method: "PATCH",
    prefer: "return=minimal",
    body: { ...patch, updated_at: new Date().toISOString() },
  });
}

/**
 * The worker's claim: lease live jobs whose lease is free or expired. The PATCH's WHERE clause
 * makes the claim atomic per row — an overlapping tick that lost the race gets zero rows back
 * and moves on, so two ticks never drive the same browser session.
 */
export async function claimDueBrowserJobs(limit: number): Promise<DbResult<BrowserJobRow[]>> {
  const nowIso = new Date().toISOString();
  const listRes = await rest<unknown[]>(
    `pa_browser_jobs?status=in.(queued,running,awaiting_approval)&or=(lease_until.is.null,lease_until.lt.${nowIso})&order=updated_at.asc&limit=${limit}&select=id`,
  );
  if (!listRes.ok) return listRes;

  const claimed: BrowserJobRow[] = [];
  for (const row of listRes.data) {
    const id = (row as { id?: unknown }).id;
    if (typeof id !== "string") continue;
    const leaseUntil = new Date(Date.now() + WORKER_LEASE_SECONDS * 1_000).toISOString();
    const claim = await rest<unknown[]>(
      `pa_browser_jobs?id=eq.${id}&or=(lease_until.is.null,lease_until.lt.${nowIso})&status=in.(queued,running,awaiting_approval)`,
      {
        method: "PATCH",
        prefer: "return=representation",
        body: { lease_until: leaseUntil, updated_at: new Date().toISOString() },
      },
    );
    if (!claim.ok) continue;
    const rows = parseJobRows(claim.data);
    if (rows[0]) claimed.push(rows[0]);
  }
  return { ok: true, data: claimed };
}

export async function releaseJobLease(jobId: string): Promise<void> {
  const res = await updateBrowserJob(jobId, { lease_until: null });
  if (!res.ok) {
    console.warn("[browser-agent/db] lease release failed", { jobId, error: res.error });
  }
}

// ── Steps ────────────────────────────────────────────────────────────────────────────────

export async function insertBrowserStep(params: {
  jobId: string;
  ownerId: string;
  stepNumber: number;
  actionKind: StepActionKind;
  actionPayload: Record<string, unknown>;
  screenshotPath: string | null;
  reasoning: string | null;
  inboxItemId?: string | null;
  approvalStatus?: "pending" | "approved" | "rejected" | null;
}): Promise<DbResult<BrowserStepRow>> {
  const res = await rest<unknown[]>("pa_browser_steps", {
    method: "POST",
    prefer: "return=representation",
    body: {
      job_id: params.jobId,
      owner_id: params.ownerId,
      step_number: params.stepNumber,
      action_kind: params.actionKind,
      action_payload: params.actionPayload,
      screenshot_path: params.screenshotPath,
      reasoning: params.reasoning,
      inbox_item_id: params.inboxItemId ?? null,
      approval_status: params.approvalStatus ?? null,
    },
  });
  if (!res.ok) return res;
  const parsed = BrowserStepRowSchema.safeParse(res.data[0]);
  if (!parsed.success) return { ok: false, status: 500, error: "Step row failed to parse after insert." };
  return { ok: true, data: parsed.data };
}

export async function updateBrowserStepApproval(params: {
  jobId: string;
  stepNumber: number;
  approvalStatus: "approved" | "rejected";
}): Promise<DbResult<undefined>> {
  return rest<undefined>(
    `pa_browser_steps?job_id=eq.${params.jobId}&step_number=eq.${params.stepNumber}`,
    {
      method: "PATCH",
      prefer: "return=minimal",
      body: { approval_status: params.approvalStatus },
    },
  );
}

export async function listBrowserSteps(params: {
  jobId: string;
  ownerId: string;
}): Promise<DbResult<BrowserStepRow[]>> {
  const res = await rest<unknown[]>(
    `pa_browser_steps?job_id=eq.${params.jobId}&owner_id=eq.${params.ownerId}&order=step_number.asc&limit=600`,
  );
  if (!res.ok) return res;
  const out: BrowserStepRow[] = [];
  for (const row of res.data) {
    const parsed = BrowserStepRowSchema.safeParse(row);
    if (parsed.success) out.push(parsed.data);
  }
  return { ok: true, data: out };
}
