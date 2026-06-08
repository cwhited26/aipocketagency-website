// lib/connectors/quickbooks/execute.ts — server-side execution of an approved QuickBooks action.
//
// This is the "fires on approve" half of the approval gate: once the owner approves a staged
// QuickBooks write (or for a read action that runs un-gated), this resolves the connection +
// realm + a fresh token, runs the QBO v3 call, and writes the audit row. QuickBooks writes are
// TypeScript + direct REST (no Modal sub-agent makes the call), so execution happens here in the
// Next runtime — the registry (lib/connectors/registry.ts) dispatches approved QuickBooks
// approvals to this function exactly as it does for Slack.
//
// `requestId` is the idempotency seed (the approval id) threaded into the QBO Request-Id header
// so a retry or crash-resume can't double-post an invoice or payment. Every failure is a typed
// result (never a silent catch).

import { createHash } from "node:crypto";
import {
  logConnectorAction,
  OrchestratorDbError,
} from "@/lib/orchestrator/db";
import { isQuickBooksAction, runQuickBooksAction } from "./index";

export const QUICKBOOKS_CONNECTOR = "quickbooks";

export type QuickBooksExecuteResult =
  | { ok: true; summary: string; data: Record<string, unknown> }
  | { ok: false; status: number; error: string };

export type ExecuteQuickBooksActionInput = {
  userId: string;
  action: string;
  payload: Record<string, unknown>;
  subAgentRunId?: string | null;
  /** Owner email for the high-priority re-auth nudge on a dead grant (best-effort). */
  ownerEmail?: string | null;
  /** Idempotency seed (the approval id). Falls back to a payload-derived hash if absent. */
  requestId?: string | null;
};

/**
 * Execute one QuickBooks action for an owner. Used by the approval route on approve (writes) and
 * is safe to call for reads. Writes the audit row in every terminal case so the timeline stays
 * accurate.
 */
export async function executeQuickBooksConnectorAction(
  input: ExecuteQuickBooksActionInput,
): Promise<QuickBooksExecuteResult> {
  if (!isQuickBooksAction(input.action)) {
    return { ok: false, status: 400, error: `Unknown QuickBooks action: ${input.action}` };
  }

  const requestId = input.requestId ?? derivedRequestId(input.action, input.payload);

  const run = await runQuickBooksAction({
    userId: input.userId,
    action: input.action,
    payload: input.payload,
    requestId,
    ownerEmail: input.ownerEmail ?? null,
  });

  if (!run.ok) {
    await logExecuted(input, "failed", run.error);
    return { ok: false, status: run.status, error: run.error };
  }

  await logExecuted(input, "executed", run.summary);
  return { ok: true, summary: run.summary, data: run.data };
}

// Deterministic fallback idempotency seed when no approval id is supplied — same (action,
// payload) yields the same Request-Id, so an un-id'd retry still dedups at Intuit.
function derivedRequestId(action: string, payload: Record<string, unknown>): string {
  return createHash("sha256")
    .update(`${action}:${JSON.stringify(payload ?? {})}`)
    .digest("hex")
    .slice(0, 32);
}

// Audit-log the terminal outcome. Best-effort: a missing audit table (migration 021 not applied)
// must not fail an otherwise-successful write. payload_hash is intentionally empty here — the
// staged row (written by the middleware) carries the canonical hash; this row records outcome.
async function logExecuted(
  input: ExecuteQuickBooksActionInput,
  status: "executed" | "failed",
  summary: string,
): Promise<void> {
  try {
    await logConnectorAction({
      businessId: input.userId,
      subAgentRunId: input.subAgentRunId ?? null,
      connector: QUICKBOOKS_CONNECTOR,
      action: input.action,
      payloadHash: "",
      status,
      responseSummary: summary.slice(0, 500),
    });
  } catch (e) {
    if (e instanceof OrchestratorDbError && e.schemaNotProvisioned) return;
    throw e;
  }
}
