// db.ts — data-access layer for the orchestrator tables (migration 021). Uses the PA
// Supabase project over PostgREST with the service-role key, mirroring lib/chat/db.ts and
// lib/personas/db.ts. RLS exposes only owner SELECTs; every write here is scoped by
// business_id / user_id in the query. Functions throw OrchestratorDbError on a hard failure
// (never a silent catch); routes translate to HTTP responses.

import {
  SubAgentRunRowSchema,
  type ActionStatus,
  type Phase,
  type RunStatus,
  type SubAgentRunRow,
  type VerificationVerdict,
} from "./types";

export class OrchestratorDbError extends Error {
  readonly status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = "OrchestratorDbError";
    this.status = status;
  }

  /**
   * True when the failure is "the orchestrator schema (migration 021) isn't provisioned in
   * this Supabase project yet" — PostgREST answers an unknown relation with 404 + PGRST205
   * ("Could not find the table … in the schema cache"). Wave B ships dark behind
   * PA_ORCHESTRATOR_ENABLED and the table can legitimately not exist yet, so callers that
   * surface owner-facing settings treat this as "nothing staged" rather than a hard 500.
   */
  get schemaNotProvisioned(): boolean {
    if (this.status !== 404) return false;
    const m = this.message.toLowerCase();
    return (
      m.includes("pgrst205") ||
      m.includes("could not find the table") ||
      m.includes("does not exist")
    );
  }
}

function env(): { url: string; key: string } {
  const url =
    process.env.POCKET_AGENT_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.WC_ADMIN_SUPABASE_URL;
  const key =
    process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.WC_ADMIN_SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new OrchestratorDbError("Supabase env vars not set", 500);
  }
  return { url: url.replace(/\/$/, ""), key };
}

type RestInit = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  prefer?: string;
  body?: unknown;
};

async function rest<T>(pathAndQuery: string, init: RestInit = {}): Promise<T> {
  const { url, key } = env();
  const headers: Record<string, string> = {
    apikey: key,
    Authorization: `Bearer ${key}`,
  };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  if (init.prefer) headers.Prefer = init.prefer;

  const res = await fetch(`${url}/rest/v1/${pathAndQuery}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new OrchestratorDbError(
      `Supabase ${init.method ?? "GET"} ${pathAndQuery.split("?")[0]} failed (${res.status}): ${text.slice(0, 200)}`,
      res.status,
    );
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

const enc = encodeURIComponent;

// ── pa_sub_agent_runs ──────────────────────────────────────────────────────────────────

export type InsertRunInput = {
  businessId: string;
  originatingMessageId?: string | null;
  status?: RunStatus;
  specJson: unknown;
  toolScopes: string[];
  timeBudgetSeconds: number;
  agentMinutes: number;
};

export async function insertRun(input: InsertRunInput): Promise<SubAgentRunRow> {
  const rows = await rest<unknown>("pa_sub_agent_runs", {
    method: "POST",
    prefer: "return=representation",
    body: {
      business_id: input.businessId,
      originating_message_id: input.originatingMessageId ?? null,
      status: input.status ?? "planning",
      spec_json: input.specJson,
      tool_scopes: input.toolScopes,
      time_budget_seconds: input.timeBudgetSeconds,
      agent_minutes: input.agentMinutes,
    },
  });
  const parsed = Array.isArray(rows) ? rows.map((r) => SubAgentRunRowSchema.parse(r)) : [];
  if (!parsed[0]) throw new OrchestratorDbError("Run insert returned no row");
  return parsed[0];
}

export async function fetchRun(id: string): Promise<SubAgentRunRow | null> {
  const rows = await rest<unknown[]>(`pa_sub_agent_runs?id=eq.${enc(id)}&limit=1`);
  const row = Array.isArray(rows) ? rows[0] : null;
  return row ? SubAgentRunRowSchema.parse(row) : null;
}

export async function listRunsForBusiness(
  businessId: string,
  limit = 100,
): Promise<SubAgentRunRow[]> {
  const rows = await rest<unknown[]>(
    `pa_sub_agent_runs?business_id=eq.${enc(businessId)}&order=created_at.desc&limit=${limit}`,
  );
  return Array.isArray(rows) ? rows.map((r) => SubAgentRunRowSchema.parse(r)) : [];
}

/** Count of non-terminal runs for a business (concurrency-cap check). */
export async function countActiveRuns(businessId: string): Promise<number> {
  const rows = await rest<{ id: string }[]>(
    `pa_sub_agent_runs?business_id=eq.${enc(businessId)}&status=in.(planning,running,paused)&select=id`,
  );
  return Array.isArray(rows) ? rows.length : 0;
}

/** All non-terminal runs across every business (the cron timeout sweep). */
export async function listAllActiveRuns(limit = 500): Promise<SubAgentRunRow[]> {
  const rows = await rest<unknown[]>(
    `pa_sub_agent_runs?status=in.(planning,running,paused)&order=started_at.asc&limit=${limit}`,
  );
  return Array.isArray(rows) ? rows.map((r) => SubAgentRunRowSchema.parse(r)) : [];
}

export type RunPatch = Partial<{
  status: RunStatus;
  startedAt: string;
  phaseProgress: unknown;
  resultSummary: string | null;
  tokenCost: number;
  agentMinutes: number;
  // Mission Control telemetry (migration 038).
  lastHeartbeatAt: string;
  retriesUsed: number;
  retryBudget: number;
  verificationVerdict: VerificationVerdict | null;
  needsHuman: boolean;
}>;

export async function updateRun(id: string, patch: RunPatch): Promise<SubAgentRunRow | null> {
  const body: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status !== undefined) body.status = patch.status;
  if (patch.startedAt !== undefined) body.started_at = patch.startedAt;
  if (patch.phaseProgress !== undefined) body.phase_progress = patch.phaseProgress;
  if (patch.resultSummary !== undefined) body.result_summary = patch.resultSummary;
  if (patch.tokenCost !== undefined) body.token_cost = patch.tokenCost;
  if (patch.agentMinutes !== undefined) body.agent_minutes = patch.agentMinutes;
  if (patch.lastHeartbeatAt !== undefined) body.last_heartbeat_at = patch.lastHeartbeatAt;
  if (patch.retriesUsed !== undefined) body.retries_used = patch.retriesUsed;
  if (patch.retryBudget !== undefined) body.retry_budget = patch.retryBudget;
  if (patch.verificationVerdict !== undefined) body.verification_verdict = patch.verificationVerdict;
  if (patch.needsHuman !== undefined) body.needs_human = patch.needsHuman;

  const rows = await rest<unknown[]>(`pa_sub_agent_runs?id=eq.${enc(id)}`, {
    method: "PATCH",
    prefer: "return=representation",
    body,
  });
  const row = Array.isArray(rows) ? rows[0] : null;
  return row ? SubAgentRunRowSchema.parse(row) : null;
}

/**
 * Stamp a run's heartbeat to now() — called by the runtime webhook on every event so the
 * Watchdog can tell a live run from a silent one. Best-effort by design (a heartbeat miss must
 * not fail the webhook), so callers handle the throw rather than this swallowing it.
 */
export async function touchHeartbeat(runId: string, nowIso: string): Promise<void> {
  await rest<undefined>(`pa_sub_agent_runs?id=eq.${enc(runId)}`, {
    method: "PATCH",
    prefer: "return=minimal",
    body: { last_heartbeat_at: nowIso, updated_at: nowIso },
  });
}

/**
 * Watchdog sweep (PA-MC-6): reclaim every live run whose heartbeat is older than `staleBeforeIso`
 * — or that has no heartbeat yet but started before the cutoff — to 'zombie' + needs_human. The
 * status filter excludes already-terminal/zombie runs, so a run is reclaimed at most once.
 * Returns the rows it flipped (for the cron's response + reconciliation).
 */
export async function flipStaleRunsToZombie(
  staleBeforeIso: string,
  nowIso: string,
): Promise<SubAgentRunRow[]> {
  const stale = enc(staleBeforeIso);
  const query =
    `pa_sub_agent_runs?status=in.(planning,running,paused,verifying)` +
    `&or=(last_heartbeat_at.lt.${stale},and(last_heartbeat_at.is.null,started_at.lt.${stale}))`;
  const rows = await rest<unknown[]>(query, {
    method: "PATCH",
    prefer: "return=representation",
    body: { status: "zombie", needs_human: true, updated_at: nowIso },
  });
  return Array.isArray(rows) ? rows.map((r) => SubAgentRunRowSchema.parse(r)) : [];
}

// ── pa_verification_log (advisory second-opinion gate, PA-MC-7) ──────────────────────────

export async function insertVerificationLog(input: {
  subAgentRunId: string;
  verdict: VerificationVerdict;
  reason: string | null;
}): Promise<void> {
  await rest<undefined>("pa_verification_log", {
    method: "POST",
    prefer: "return=minimal",
    body: {
      sub_agent_run_id: input.subAgentRunId,
      verdict: input.verdict,
      reason: input.reason,
    },
  });
}

/** Count 'fail' verdicts logged against a run — drives the 2+-strike needs_human flip. */
export async function countVerificationFailures(runId: string): Promise<number> {
  const rows = await rest<{ id: string }[]>(
    `pa_verification_log?sub_agent_run_id=eq.${enc(runId)}&verdict=eq.fail&select=id`,
  );
  return Array.isArray(rows) ? rows.length : 0;
}

// ── pa_sub_agent_phase_log ─────────────────────────────────────────────────────────────

export async function logPhaseEnter(
  runId: string,
  phase: Phase,
  notes?: string,
): Promise<void> {
  await rest<undefined>("pa_sub_agent_phase_log", {
    method: "POST",
    prefer: "return=minimal",
    body: { run_id: runId, phase, notes: notes ?? null },
  });
}

/** Patches the most recent phase row of a run with its measured duration. */
export async function logPhaseComplete(
  runId: string,
  phase: Phase,
  durationMs: number,
): Promise<void> {
  // Find the latest open (duration_ms null) row for this run+phase and stamp it.
  const rows = await rest<{ id: string }[]>(
    `pa_sub_agent_phase_log?run_id=eq.${enc(runId)}&phase=eq.${enc(phase)}&duration_ms=is.null&order=entered_at.desc&limit=1&select=id`,
  );
  const id = Array.isArray(rows) ? rows[0]?.id : undefined;
  if (!id) return;
  await rest<undefined>(`pa_sub_agent_phase_log?id=eq.${enc(id)}`, {
    method: "PATCH",
    prefer: "return=minimal",
    body: { duration_ms: durationMs },
  });
}

export type PhaseLogRow = {
  id: string;
  run_id: string;
  phase: Phase;
  entered_at: string;
  duration_ms: number | null;
  notes: string | null;
};

/** The full phase timeline of a run (oldest first) for the activity card. */
export async function listPhaseLog(runId: string): Promise<PhaseLogRow[]> {
  const rows = await rest<PhaseLogRow[]>(
    `pa_sub_agent_phase_log?run_id=eq.${enc(runId)}&order=entered_at.asc&select=id,run_id,phase,entered_at,duration_ms,notes`,
  );
  return Array.isArray(rows) ? rows : [];
}

// ── pa_connector_action_log ────────────────────────────────────────────────────────────

export async function logConnectorAction(input: {
  businessId: string;
  subAgentRunId: string | null;
  connector: string;
  action: string;
  payloadHash: string;
  status: ActionStatus;
  responseSummary?: string | null;
}): Promise<{ id: string }> {
  const rows = await rest<{ id: string }[]>("pa_connector_action_log", {
    method: "POST",
    prefer: "return=representation",
    body: {
      business_id: input.businessId,
      sub_agent_run_id: input.subAgentRunId,
      connector: input.connector,
      action: input.action,
      payload_hash: input.payloadHash,
      status: input.status,
      response_summary: input.responseSummary ?? null,
    },
  });
  const id = Array.isArray(rows) ? rows[0]?.id : undefined;
  if (!id) throw new OrchestratorDbError("Connector action log insert returned no row");
  return { id };
}

export async function updateConnectorActionStatus(
  id: string,
  status: ActionStatus,
  responseSummary?: string | null,
): Promise<void> {
  const body: Record<string, unknown> = { status };
  if (responseSummary !== undefined) body.response_summary = responseSummary;
  await rest<undefined>(`pa_connector_action_log?id=eq.${enc(id)}`, {
    method: "PATCH",
    prefer: "return=minimal",
    body,
  });
}

export async function listConnectorActionLog(
  businessId: string,
  limit = 100,
): Promise<
  {
    id: string;
    connector: string;
    action: string;
    status: ActionStatus;
    response_summary: string | null;
    created_at: string;
  }[]
> {
  const rows = await rest<
    {
      id: string;
      connector: string;
      action: string;
      status: ActionStatus;
      response_summary: string | null;
      created_at: string;
    }[]
  >(
    `pa_connector_action_log?business_id=eq.${enc(businessId)}&order=created_at.desc&limit=${limit}` +
      `&select=id,connector,action,status,response_summary,created_at`,
  );
  return Array.isArray(rows) ? rows : [];
}

/**
 * Count audit rows for a business + connector at a given status since `sinceIso`, optionally
 * restricted to a set of actions. Backs the Slack per-minute send cap (count executed write
 * actions in the last 60s) — a DB count is correct across serverless invocations where an
 * in-memory counter would not be.
 */
export async function countRecentConnectorActions(input: {
  businessId: string;
  connector: string;
  status: ActionStatus;
  sinceIso: string;
  actions?: readonly string[];
}): Promise<number> {
  let path =
    `pa_connector_action_log?business_id=eq.${enc(input.businessId)}` +
    `&connector=eq.${enc(input.connector)}&status=eq.${enc(input.status)}` +
    `&created_at=gte.${enc(input.sinceIso)}&select=id`;
  if (input.actions && input.actions.length > 0) {
    path += `&action=in.(${input.actions.map((a) => enc(a)).join(",")})`;
  }
  const rows = await rest<{ id: string }[]>(path);
  return Array.isArray(rows) ? rows.length : 0;
}

// ── pa_action_approvals ────────────────────────────────────────────────────────────────

export type ActionApprovalRow = {
  id: string;
  inbox_item_id: string;
  business_id: string;
  sub_agent_run_id: string | null;
  connector: string;
  action: string;
  payload: Record<string, unknown>;
  auto_approve_eligible: boolean;
  created_at: string;
};

export async function insertActionApproval(input: {
  inboxItemId: string;
  businessId: string;
  subAgentRunId: string | null;
  connector: string;
  action: string;
  payload: Record<string, unknown>;
  autoApproveEligible: boolean;
}): Promise<ActionApprovalRow> {
  const rows = await rest<ActionApprovalRow[]>("pa_action_approvals", {
    method: "POST",
    prefer: "return=representation",
    body: {
      inbox_item_id: input.inboxItemId,
      business_id: input.businessId,
      sub_agent_run_id: input.subAgentRunId,
      connector: input.connector,
      action: input.action,
      payload: input.payload,
      auto_approve_eligible: input.autoApproveEligible,
    },
  });
  if (!rows[0]) throw new OrchestratorDbError("Action approval insert returned no row");
  return rows[0];
}

export async function fetchActionApprovalByInboxItem(
  inboxItemId: string,
): Promise<ActionApprovalRow | null> {
  const rows = await rest<ActionApprovalRow[]>(
    `pa_action_approvals?inbox_item_id=eq.${enc(inboxItemId)}&limit=1`,
  );
  return rows[0] ?? null;
}

/** Replace the (editable) action payload before approval. Owner-scoped by the caller. */
export async function updateActionApprovalPayload(
  id: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await rest<undefined>(`pa_action_approvals?id=eq.${enc(id)}`, {
    method: "PATCH",
    prefer: "return=minimal",
    body: { payload },
  });
}

/**
 * Best-effort: move the latest staged audit-log row for a run+connector+action to a new
 * status (approved / rejected). The audit feed is non-load-bearing, so a miss is silent.
 */
export async function markConnectorActionStatusByRun(input: {
  runId: string;
  connector: string;
  action: string;
  status: ActionStatus;
}): Promise<void> {
  const rows = await rest<{ id: string }[]>(
    `pa_connector_action_log?sub_agent_run_id=eq.${enc(input.runId)}` +
      `&connector=eq.${enc(input.connector)}&action=eq.${enc(input.action)}` +
      `&status=eq.staged&order=created_at.desc&limit=1&select=id`,
  ).catch(() => [] as { id: string }[]);
  const id = rows[0]?.id;
  if (!id) return;
  await updateConnectorActionStatus(id, input.status);
}

// ── pa_auto_approve_settings ───────────────────────────────────────────────────────────

export type AutoApproveSettingRow = {
  user_id: string;
  connector: string;
  action: string;
  enabled: boolean;
  success_count: number;
  last_toggled_at: string | null;
  updated_at: string;
};

export async function listAutoApproveSettings(
  userId: string,
): Promise<AutoApproveSettingRow[]> {
  const rows = await rest<AutoApproveSettingRow[]>(
    `pa_auto_approve_settings?user_id=eq.${enc(userId)}&order=connector.asc,action.asc`,
  );
  return Array.isArray(rows) ? rows : [];
}

export async function fetchAutoApproveSetting(
  userId: string,
  connector: string,
  action: string,
): Promise<AutoApproveSettingRow | null> {
  const rows = await rest<AutoApproveSettingRow[]>(
    `pa_auto_approve_settings?user_id=eq.${enc(userId)}&connector=eq.${enc(connector)}&action=eq.${enc(action)}&limit=1`,
  );
  return rows[0] ?? null;
}

export async function setAutoApproveEnabled(input: {
  userId: string;
  connector: string;
  action: string;
  enabled: boolean;
}): Promise<AutoApproveSettingRow> {
  const rows = await rest<AutoApproveSettingRow[]>(
    "pa_auto_approve_settings?on_conflict=user_id,connector,action",
    {
      method: "POST",
      prefer: "return=representation,resolution=merge-duplicates",
      body: {
        user_id: input.userId,
        connector: input.connector,
        action: input.action,
        enabled: input.enabled,
        last_toggled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    },
  );
  if (!rows[0]) throw new OrchestratorDbError("Auto-approve upsert returned no row");
  return rows[0];
}

/** Atomic +1 of the trust-window success count (RPC from migration 021). Returns new count. */
export async function recordAutoApproveSuccess(
  userId: string,
  connector: string,
  action: string,
): Promise<number> {
  const count = await rest<number>("rpc/orchestrator_record_auto_approve_success", {
    method: "POST",
    body: { p_user_id: userId, p_connector: connector, p_action: action },
  });
  return typeof count === "number" ? count : 0;
}

// ── pa_orchestrator_usage_monthly + RPCs ───────────────────────────────────────────────

export type OrchestratorUsageRow = {
  business_id: string;
  month: string;
  agent_minutes_used: number;
  total_cost: number;
  run_count: number;
};

export async function fetchOrchestratorUsage(
  businessId: string,
  month: string,
): Promise<OrchestratorUsageRow | null> {
  const rows = await rest<OrchestratorUsageRow[]>(
    `pa_orchestrator_usage_monthly?business_id=eq.${enc(businessId)}&month=eq.${enc(month)}&limit=1`,
  );
  return rows[0] ?? null;
}

/**
 * Atomically reserve agent-minutes against the month's cap (RPC from migration 021).
 * Returns true iff reserved. cap === null means unlimited.
 */
export async function reserveAgentMinutes(input: {
  businessId: string;
  month: string;
  minutes: number;
  cap: number | null;
}): Promise<boolean> {
  const ok = await rest<boolean>("rpc/orchestrator_reserve_agent_minutes", {
    method: "POST",
    body: {
      p_business_id: input.businessId,
      p_month: input.month,
      p_minutes: input.minutes,
      p_cap: input.cap,
    },
  });
  return ok === true;
}

/** Swap a run's reserved estimate for its measured actual and add cost (RPC from 021). */
export async function reconcileAgentMinutes(input: {
  businessId: string;
  month: string;
  reserved: number;
  actual: number;
  cost: number;
}): Promise<void> {
  await rest<undefined>("rpc/orchestrator_reconcile_agent_minutes", {
    method: "POST",
    prefer: "return=minimal",
    body: {
      p_business_id: input.businessId,
      p_month: input.month,
      p_reserved: input.reserved,
      p_actual: input.actual,
      p_cost: input.cost,
    },
  });
}
