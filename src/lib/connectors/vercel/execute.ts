// connectors/vercel/execute.ts — server-side execution of an approved Vercel build action.
//
// This is the "fires on approve" half of the approval gate: once the owner approves a staged Vercel
// action (or for the read action that runs un-gated), this resolves the connection + token, runs the
// Vercel REST call, writes the audit row, and — on createProject success — records the new project on
// the originating PA project's Workspace row (Build Tools roadmap §7.5; deliverable: createProject →
// workspace gets vercel_project_id + vercel_project_name). Vercel actions are TypeScript + direct REST
// (no Modal sub-agent makes the call), so execution happens here in the Next runtime — the registry
// (lib/connectors/registry.ts) dispatches approved Vercel approvals to this function exactly as it
// does for Slack / QuickBooks.
//
// Every failure is a typed result (never a silent catch). The workspace write-back is best-effort:
// the build action already succeeded on Vercel, so a missing workspace table / row must NOT turn a
// real success into a reported failure — it is logged-by-return, not thrown.

import {
  logConnectorAction,
  OrchestratorDbError,
} from "@/lib/orchestrator/db";
import { linkVercelProjectToWorkspace } from "./workspace";
import { isVercelAction, runVercelAction } from "./index";

export const VERCEL_CONNECTOR = "vercel";

export type VercelExecuteResult =
  | { ok: true; summary: string; data: Record<string, unknown> }
  | { ok: false; status: number; error: string };

export type ExecuteVercelActionInput = {
  userId: string;
  action: string;
  payload: Record<string, unknown>;
  subAgentRunId?: string | null;
  /** Owner email — accepted for parity with the registry signature (Vercel needs no re-auth ping). */
  ownerEmail?: string | null;
};

/**
 * Execute one Vercel action for an owner. Used by the approval route on approve (gated actions) and
 * is safe to call for the read action. Writes the audit row in every terminal case so the timeline
 * stays accurate, and threads a successful createProject into the project Workspace.
 */
export async function executeVercelConnectorAction(
  input: ExecuteVercelActionInput,
): Promise<VercelExecuteResult> {
  if (!isVercelAction(input.action)) {
    return { ok: false, status: 400, error: `Unknown Vercel action: ${input.action}` };
  }

  const run = await runVercelAction({
    userId: input.userId,
    action: input.action,
    payload: input.payload,
  });

  if (!run.ok) {
    await logExecuted(input, "failed", run.error);
    return { ok: false, status: run.status, error: run.error };
  }

  // createProject → record the new Vercel project on the originating PA project's Workspace row, so
  // the owner's Workspace panel shows it. Keyed by the `projectId` the caller threaded through the
  // action payload; absent it, there's no Project to attach to and we skip the write-back.
  if (input.action === "createProject") {
    const projectId = typeof input.payload.projectId === "string" ? input.payload.projectId : null;
    const vercelProjectId = typeof run.data.projectId === "string" ? run.data.projectId : null;
    const vercelProjectName = typeof run.data.projectName === "string" ? run.data.projectName : null;
    if (projectId && vercelProjectId) {
      // Best-effort: a failure here must not undo a real Vercel project creation.
      const link = await linkVercelProjectToWorkspace({
        projectId,
        ownerUserId: input.userId,
        vercelProjectId,
        vercelProjectName,
      });
      if (!link.linked) {
        await logConnectorAction({
          businessId: input.userId,
          subAgentRunId: input.subAgentRunId ?? null,
          connector: VERCEL_CONNECTOR,
          action: "createProject",
          payloadHash: "",
          status: "executed",
          responseSummary: `Project created; workspace link deferred (${link.reason.slice(0, 200)}).`,
        }).catch((e) => {
          if (e instanceof OrchestratorDbError && e.schemaNotProvisioned) return;
          throw e;
        });
      }
    }
  }

  await logExecuted(input, "executed", run.summary);
  return { ok: true, summary: run.summary, data: run.data };
}

// Audit-log the terminal outcome. Best-effort: a missing audit table (migration 021 not applied)
// must not fail an otherwise-successful action. payload_hash is empty here — the staged row (written
// by the middleware) carries the canonical hash; this row records the outcome.
async function logExecuted(
  input: ExecuteVercelActionInput,
  status: "executed" | "failed",
  summary: string,
): Promise<void> {
  try {
    await logConnectorAction({
      businessId: input.userId,
      subAgentRunId: input.subAgentRunId ?? null,
      connector: VERCEL_CONNECTOR,
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
