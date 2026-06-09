// connectors/supabase/index.ts — the Supabase Build Connector entry point.
//
// Exposes the action registry + per-action approval gate (for the staging route + the Inbox UI),
// the auto-approve eligibility policy (apply_migration is hard-excluded — single-approval forever),
// and executeSupabaseConnectorAction — the in-process executor the build-approval route calls the
// moment the owner approves a staged write (and that the action route calls directly for reads).
//
// All calls are TypeScript + direct REST against the Supabase Management API (./api.ts); nothing
// runs in Modal. Connection + token resolution + audit logging live here; the per-action REST and
// the SQL guard live in ./actions.ts + ./sql-guard.ts.

import { createHash } from "node:crypto";
import { logConnectorAction, OrchestratorDbError } from "@/lib/orchestrator/db";
import {
  fetchSupabaseConnectionFull,
  markSupabaseConnectionError,
} from "@/lib/pa-supabase-connections";
import { decrypt } from "@/lib/crypto/encrypt";
import { extendWorkspace } from "@/lib/projects/workspace";
import { SUPABASE_CONNECTOR, type ApprovalGate, type SupabaseActionMeta, type SupabaseActionName } from "./types";
import {
  CreateProjectInputSchema,
  ApplyMigrationInputSchema,
  SeedDataInputSchema,
  RunSqlReadOnlyInputSchema,
  GetConnectionStringInputSchema,
  executeCreateProject,
  executeApplyMigration,
  executeSeedData,
  executeRunSqlReadOnly,
  executeGetConnectionString,
} from "./actions";

export { SUPABASE_CONNECTOR };

// ── Action registry (meta only — safe to surface in the UI / scope lists) ──────────────────────
const GATES: Record<SupabaseActionName, ApprovalGate> = {
  create_project: "gated",
  apply_migration: "always_gated", // irreversible data-layer change → never auto-approve
  seed_data: "gated",
  run_sql_read_only: "read",
  get_connection_string: "read",
};

const DESCRIPTIONS: Record<SupabaseActionName, string> = {
  create_project: "Provision a new Supabase project in your organization.",
  apply_migration: "Apply a migration (schema change) to a project — single-approval, always.",
  seed_data: "Seed rows into a project's tables.",
  run_sql_read_only: "Run a read-only SELECT against a project (no writes).",
  get_connection_string: "Get a project's database connection string.",
};

export const SUPABASE_ACTIONS: readonly SupabaseActionMeta[] = (
  Object.keys(GATES) as SupabaseActionName[]
).map((name) => ({
  name,
  connector: SUPABASE_CONNECTOR,
  description: DESCRIPTIONS[name],
  gate: GATES[name],
}));

const KNOWN_ACTIONS = new Set<string>(Object.keys(GATES));

export function isSupabaseAction(action: string): action is SupabaseActionName {
  return KNOWN_ACTIONS.has(action);
}

export function supabaseActionGate(action: SupabaseActionName): ApprovalGate {
  return GATES[action];
}

/** Read-only actions bypass the approval Inbox entirely (run inline). */
export function isSupabaseReadOnly(action: SupabaseActionName): boolean {
  return GATES[action] === "read";
}

/**
 * Actions that can NEVER become auto-approve eligible, regardless of how many were approved
 * (gate === "always_gated"). apply_migration is the canonical case: a migration is an irreversible
 * change to the owner's live data layer, so there is no trust window that ever unlocks it. The
 * build-approval route consults this to skip the trust-window bump entirely — double enforcement
 * alongside the Infinity entry in CONNECTOR_ACTION_TRUST_OVERRIDES.
 */
export function isSupabaseNeverAutoApprove(action: SupabaseActionName): boolean {
  return GATES[action] === "always_gated";
}

// ── High-level: resolve the connection + PAT, then execute ─────────────────────────────────────

export type SupabaseExecuteResult =
  | { ok: true; summary: string; data: Record<string, unknown> }
  | { ok: false; status: number; error: string };

export type RunSupabaseActionInput = {
  userId: string;
  action: string;
  payload: Record<string, unknown>;
};

/**
 * Execute one Supabase action for an owner. Used by the build-approval route on approve (writes)
 * and the action route for reads. Resolves the connection + decrypts the PAT, validates the
 * payload, runs the action, and audit-logs mutating outcomes. A hard auth failure (revoked PAT)
 * flips the connection to status='error' so the card prompts a re-paste.
 */
export async function runSupabaseAction(
  input: RunSupabaseActionInput,
): Promise<SupabaseExecuteResult> {
  if (!isSupabaseAction(input.action)) {
    return { ok: false, status: 400, error: `Unknown Supabase action: ${input.action}` };
  }
  const action = input.action;

  const conn = await fetchSupabaseConnectionFull(input.userId);
  if (!conn.ok) return { ok: false, status: conn.status, error: conn.error };
  if (!conn.data || conn.data.status === "revoked" || !conn.data.pat) {
    return {
      ok: false,
      status: 409,
      error: "Connect Supabase in Settings → Connections (paste your access token) before running Supabase actions.",
    };
  }
  const pat = conn.data.pat;

  const outcome = await dispatch(action, pat, input.payload, conn.data.orgId);

  if (!outcome.ok) {
    if (!isSupabaseReadOnly(action)) await logExecuted(input.userId, action, "failed", outcome.error);
    if (outcome.authError) {
      await markSupabaseConnectionError(conn.data.id);
      return {
        ok: false,
        status: 401,
        error: "Supabase disconnected — your access token was rejected. Re-paste it in Settings → Connections.",
      };
    }
    return { ok: false, status: outcome.status, error: outcome.error };
  }

  if (!isSupabaseReadOnly(action)) await logExecuted(input.userId, action, "executed", outcome.summary);

  // On a successful createProject that names a PA project, record the new ref to that project's
  // workspace ledger (the shared Project Workspace primitive). Best-effort: a missing project link
  // or unprovisioned workspace must not undo a successful provision (mirrors github-build's
  // linkRepoToWorkspace).
  if (action === "create_project") {
    const projectId = str(input.payload.project_id);
    const ref = str(outcome.data.projectRef);
    if (projectId && ref) {
      await extendWorkspace(projectId, input.userId, {
        supabaseProjectRef: ref,
        supabaseProjectName: str(outcome.data.projectName) || ref,
        status: "live",
      }).catch(() => undefined);
    }
  }

  return { ok: true, summary: outcome.summary, data: outcome.data };
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

// Validate the payload with the action's schema and run it. createProject's org defaults to the
// connection's stored org when the payload omits it. The db_pass is staged AES-256-GCM-encrypted
// (never plaintext in pa_action_approvals), so it is decrypted here at the point of execution.
async function dispatch(
  action: SupabaseActionName,
  pat: string,
  payload: Record<string, unknown>,
  defaultOrgId: string | null,
) {
  switch (action) {
    case "create_project": {
      const prepared = decryptDbPass(payload);
      if (!prepared.ok) return badPayload(prepared.error);
      const parsed = CreateProjectInputSchema.safeParse(prepared.payload);
      if (!parsed.success) return badPayload(parsed.error.message);
      const orgId = parsed.data.org_id ?? defaultOrgId;
      if (!orgId) {
        return badPayload(
          "No Supabase organization to create the project in — reconnect Supabase or pass org_id.",
        );
      }
      return executeCreateProject({ pat, input: { ...parsed.data, org_id: orgId } });
    }
    case "apply_migration": {
      const parsed = ApplyMigrationInputSchema.safeParse(payload);
      if (!parsed.success) return badPayload(parsed.error.message);
      return executeApplyMigration({ pat, input: parsed.data });
    }
    case "seed_data": {
      const parsed = SeedDataInputSchema.safeParse(payload);
      if (!parsed.success) return badPayload(parsed.error.message);
      return executeSeedData({ pat, input: parsed.data });
    }
    case "run_sql_read_only": {
      const parsed = RunSqlReadOnlyInputSchema.safeParse(payload);
      if (!parsed.success) return badPayload(parsed.error.message);
      return executeRunSqlReadOnly({ pat, input: parsed.data });
    }
    case "get_connection_string": {
      const parsed = GetConnectionStringInputSchema.safeParse(payload);
      if (!parsed.success) return badPayload(parsed.error.message);
      return executeGetConnectionString({ pat, input: parsed.data });
    }
    default: {
      // Exhaustiveness: every SupabaseActionName is handled above.
      const _never: never = action;
      return badPayload(`Unknown supabase action: ${String(_never)}`);
    }
  }
}

function badPayload(message: string) {
  return { ok: false as const, status: 422, error: message, authError: false };
}

// createProject's db_pass is staged encrypted (db_pass_encrypted) so the secret is never plaintext
// at rest in pa_action_approvals. Decrypt it back into db_pass here, just before the API call. A
// raw db_pass (e.g. an inline test call) is passed through untouched.
function decryptDbPass(
  payload: Record<string, unknown>,
): { ok: true; payload: Record<string, unknown> } | { ok: false; error: string } {
  const enc = payload.db_pass_encrypted;
  if (typeof enc !== "string" || enc.length === 0) return { ok: true, payload };
  let dbPass: string;
  try {
    dbPass = decrypt(enc);
  } catch {
    return { ok: false, error: "Couldn't read the saved database password — re-stage this project creation." };
  }
  const next: Record<string, unknown> = { ...payload, db_pass: dbPass };
  delete next.db_pass_encrypted;
  return { ok: true, payload: next };
}

// ── Registry executor + audit log ──────────────────────────────────────────────────────────────

export type ExecuteSupabaseActionInput = {
  userId: string;
  action: string;
  payload: Record<string, unknown>;
  subAgentRunId?: string | null;
};

/** Registry entry-point — identical shape to the Slack / QuickBooks executors. */
export async function executeSupabaseConnectorAction(
  input: ExecuteSupabaseActionInput,
): Promise<SupabaseExecuteResult> {
  return runSupabaseAction({ userId: input.userId, action: input.action, payload: input.payload });
}

// Deterministic payload hash for the audit row (never the raw SQL / token).
export function payloadHash(payload: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(payload ?? {})).digest("hex");
}

// Audit-log the terminal outcome of a write. Best-effort: a missing audit table (migration 021
// not applied) must not fail an otherwise-successful action.
async function logExecuted(
  userId: string,
  action: SupabaseActionName,
  status: "executed" | "failed",
  summary: string,
): Promise<void> {
  try {
    await logConnectorAction({
      businessId: userId,
      subAgentRunId: null,
      connector: SUPABASE_CONNECTOR,
      action,
      payloadHash: "",
      status,
      responseSummary: summary.slice(0, 500),
    });
  } catch (e) {
    if (e instanceof OrchestratorDbError && e.schemaNotProvisioned) return;
    throw e;
  }
}
