// db.ts — data access for the gate tables (migration 060): pa_gate_findings + pa_gate_overrides,
// plus the atomic gate_record_result RPC. Service-role over PostgREST, mirroring
// lib/orchestrator/db.ts. RLS exposes only owner SELECTs; every write is scoped by
// business_id / user_id in the query. Throws OrchestratorDbError on a hard failure (never a silent
// catch); routes translate to HTTP responses.

import { OrchestratorDbError } from "../db";
import { GATE_NAMES, type GateFinding, type GateName, type GateStatus } from "./schema";

function env(): { url: string; key: string } {
  const url =
    process.env.POCKET_AGENT_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.WC_ADMIN_SUPABASE_URL;
  const key =
    process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.WC_ADMIN_SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new OrchestratorDbError("Supabase env vars not set", 500);
  return { url: url.replace(/\/$/, ""), key };
}

type RestInit = { method?: "GET" | "POST" | "PATCH"; prefer?: string; body?: unknown };

async function rest<T>(pathAndQuery: string, init: RestInit = {}): Promise<T> {
  const { url, key } = env();
  const headers: Record<string, string> = { apikey: key, Authorization: `Bearer ${key}` };
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
  return (text ? JSON.parse(text) : undefined) as T;
}

const enc = encodeURIComponent;

// ── pa_gate_findings ───────────────────────────────────────────────────────────────────

export type GateFindingInsert = {
  businessId: string;
  projectId: string;
  planVersion: number;
  gateName: GateName;
  status: GateStatus;
  finding: GateFinding | null;
  timeBudgetMs: number;
  actualMs: number;
};

/** Persists one batch of per-gate findings for a (project, plan_version). One round trip. */
export async function insertGateFindings(rows: GateFindingInsert[]): Promise<void> {
  if (rows.length === 0) return;
  await rest<undefined>("pa_gate_findings", {
    method: "POST",
    prefer: "return=minimal",
    body: rows.map((r) => ({
      business_id: r.businessId,
      project_id: r.projectId,
      plan_version: r.planVersion,
      gate_name: r.gateName,
      status: r.status,
      finding: r.finding,
      time_budget_ms: r.timeBudgetMs,
      actual_ms: r.actualMs,
    })),
  });
}

// ── pa_gate_overrides ──────────────────────────────────────────────────────────────────

export type GateOverrideRow = {
  user_id: string;
  gate_name: GateName;
  enabled: boolean;
  auto_dismiss_threshold: number;
  clean_pass_count: number;
  auto_dismiss_enabled: boolean;
  last_toggled_at: string | null;
  updated_at: string;
};

function isGateName(v: unknown): v is GateName {
  return typeof v === "string" && (GATE_NAMES as readonly string[]).includes(v);
}

/** All of an owner's gate-override rows (Trust Ladder). Gates with no row yet use library defaults. */
export async function listGateOverrides(userId: string): Promise<GateOverrideRow[]> {
  const rows = await rest<GateOverrideRow[]>(
    `pa_gate_overrides?user_id=eq.${enc(userId)}&order=gate_name.asc`,
  );
  return Array.isArray(rows) ? rows.filter((r) => isGateName(r.gate_name)) : [];
}

export async function fetchGateOverride(
  userId: string,
  gateName: GateName,
): Promise<GateOverrideRow | null> {
  const rows = await rest<GateOverrideRow[]>(
    `pa_gate_overrides?user_id=eq.${enc(userId)}&gate_name=eq.${enc(gateName)}&limit=1`,
  );
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

/** Upsert one column of an override row (enabled or auto_dismiss_enabled), stamping last_toggled_at. */
export async function upsertGateOverride(input: {
  userId: string;
  gateName: GateName;
  enabled?: boolean;
  autoDismissEnabled?: boolean;
}): Promise<GateOverrideRow> {
  const body: Record<string, unknown> = {
    user_id: input.userId,
    gate_name: input.gateName,
    last_toggled_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (input.enabled !== undefined) body.enabled = input.enabled;
  if (input.autoDismissEnabled !== undefined) body.auto_dismiss_enabled = input.autoDismissEnabled;

  const rows = await rest<GateOverrideRow[]>("pa_gate_overrides?on_conflict=user_id,gate_name", {
    method: "POST",
    prefer: "return=representation,resolution=merge-duplicates",
    body,
  });
  if (!rows[0]) throw new OrchestratorDbError("Gate override upsert returned no row");
  return rows[0];
}

/**
 * Atomic per-gate trust-window update (RPC from migration 060). clean=true → +1; any flag/hard_fail
 * → reset to 0. Returns the new clean_pass_count. `threshold` seeds the row on first sight.
 */
export async function recordGateResult(input: {
  userId: string;
  gateName: GateName;
  clean: boolean;
  threshold: number;
}): Promise<number> {
  const count = await rest<number>("rpc/gate_record_result", {
    method: "POST",
    body: {
      p_user_id: input.userId,
      p_gate_name: input.gateName,
      p_clean: input.clean,
      p_threshold: input.threshold,
    },
  });
  return typeof count === "number" ? count : 0;
}
