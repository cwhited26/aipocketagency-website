// connectors/modal-sandbox/execute.ts — the "fires on approve" half of the Modal Sandbox
// connector. Once the owner approves a staged sandbox action (or for the un-gated stop /
// read-only status), the registry (lib/connectors/registry.ts) dispatches here: validate the
// payload, run the direct-REST call against the Modal app's `/sandbox/*` endpoint, write the audit
// row, and — on a successful spawn — record the container id back to the Project Workspace.
//
// Sandbox actions are TypeScript + direct REST (no Modal sub-agent makes the call), so execution
// happens in the Next runtime, exactly like Slack / QuickBooks / Stripe. Every failure is a typed
// result; nothing is swallowed.

import { logConnectorAction, OrchestratorDbError } from "@/lib/orchestrator/db";
import {
  GetContainerStatusInputSchema,
  RunCommandInputSchema,
  SpawnContainerInputSchema,
  StopContainerInputSchema,
  getContainerStatus,
  isModalSandboxAction,
  runCommand,
  spawnContainer,
  stopContainer,
} from "./actions";
import { dangerReason } from "./commands";
import { recordContainerToWorkspace } from "./workspace";
import { MODAL_SANDBOX_CONNECTOR } from "./types";
import type { ModalSandboxActionName, SandboxExecOutcome } from "./types";

export { MODAL_SANDBOX_CONNECTOR } from "./types";

export type ModalSandboxExecuteResult =
  | { ok: true; summary: string; data: Record<string, unknown> }
  | { ok: false; status: number; error: string };

export type ExecuteModalSandboxActionInput = {
  userId: string;
  action: string;
  payload: Record<string, unknown>;
  subAgentRunId?: string | null;
  /** Unused for sandbox (no provider OAuth to re-auth); accepted for registry signature parity. */
  ownerEmail?: string | null;
};

function badPayload(message: string): SandboxExecOutcome {
  return { ok: false, status: 422, error: message };
}

/**
 * Validate `payload` with the action's schema and run it against the Modal app. Pure dispatch:
 * resolves the typed input, runs the action, and normalizes to SandboxExecOutcome. spawn_container
 * additionally records its container id to the Project Workspace (best-effort).
 */
async function executeCore(
  userId: string,
  action: ModalSandboxActionName,
  payload: Record<string, unknown>,
): Promise<SandboxExecOutcome> {
  switch (action) {
    case "spawn_container": {
      const parsed = SpawnContainerInputSchema.safeParse(payload);
      if (!parsed.success) return badPayload(parsed.error.message);
      const r = await spawnContainer(parsed.data);
      if (!r.ok) return { ok: false, status: r.status, error: r.error };

      const link = await recordContainerToWorkspace({
        userId,
        projectId: parsed.data.project_id,
        containerId: r.data.container_id,
      });
      const cloneNote = parsed.data.repo
        ? r.data.repo_cloned
          ? ` Cloned ${parsed.data.repo}.`
          : ` Repo clone failed${r.data.clone_error ? `: ${r.data.clone_error}` : ""}.`
        : "";
      const linkNote = link.recorded
        ? " Linked to the Project workspace."
        : ` Workspace link deferred (${link.reason ?? "not provisioned"}).`;
      return {
        ok: true,
        summary: `Spawned container ${r.data.container_id}.${cloneNote}${linkNote}`,
        data: { ...r.data, workspace_recorded: link.recorded, workspace_reason: link.reason ?? null },
      };
    }
    case "run_command": {
      const parsed = RunCommandInputSchema.safeParse(payload);
      if (!parsed.success) return badPayload(parsed.error.message);
      const r = await runCommand(parsed.data);
      if (!r.ok) return { ok: false, status: r.status, error: r.error };
      const ok = r.data.exit_code === 0;
      const warn = dangerReason(parsed.data.command) ? " (shell command — single-approval)" : "";
      return {
        ok: true,
        summary:
          `\`${parsed.data.command}\` exited ${r.data.exit_code}` +
          `${ok ? "" : " (non-zero)"}${r.data.cached ? " (cached)" : ""}${warn}`,
        data: { ...r.data, command: parsed.data.command, workdir: parsed.data.workdir ?? null },
      };
    }
    case "stop_container": {
      const parsed = StopContainerInputSchema.safeParse(payload);
      if (!parsed.success) return badPayload(parsed.error.message);
      const r = await stopContainer(parsed.data);
      if (!r.ok) return { ok: false, status: r.status, error: r.error };
      return {
        ok: true,
        summary: r.data.stopped
          ? `Stopped container ${parsed.data.container_id}.`
          : `Container ${parsed.data.container_id} could not be stopped${r.data.error ? `: ${r.data.error}` : ""}.`,
        data: { ...r.data, container_id: parsed.data.container_id },
      };
    }
    case "get_container_status": {
      const parsed = GetContainerStatusInputSchema.safeParse(payload);
      if (!parsed.success) return badPayload(parsed.error.message);
      const r = await getContainerStatus(parsed.data);
      if (!r.ok) return { ok: false, status: r.status, error: r.error };
      return {
        ok: true,
        summary: `Container ${parsed.data.container_id} is ${r.data.status}.`,
        data: { ...r.data },
      };
    }
    default: {
      // Exhaustiveness: every ModalSandboxActionName is handled above.
      const _never: never = action;
      return badPayload(`Unknown modal_sandbox action: ${String(_never)}`);
    }
  }
}

/**
 * Execute one Modal Sandbox action for an owner. Used by the approval route on approve (spawn /
 * run) and is safe to call for the un-gated stop / read-only status. Writes an audit row for every
 * mutating terminal outcome (spawn / run / stop); reads are not logged.
 */
export async function executeModalSandboxConnectorAction(
  input: ExecuteModalSandboxActionInput,
): Promise<ModalSandboxExecuteResult> {
  if (!isModalSandboxAction(input.action)) {
    return { ok: false, status: 400, error: `Unknown Modal Sandbox action: ${input.action}` };
  }
  const action = input.action;

  const outcome = await executeCore(input.userId, action, input.payload);
  const mutating = action !== "get_container_status";

  if (!outcome.ok) {
    if (mutating) await logExecuted(input, action, "failed", outcome.error);
    return { ok: false, status: outcome.status, error: outcome.error };
  }

  if (mutating) await logExecuted(input, action, "executed", outcome.summary);
  return { ok: true, summary: outcome.summary, data: outcome.data };
}

// Audit-log the terminal outcome of a mutating action. Best-effort: a missing audit table
// (migration 021 not applied) must not fail an otherwise-successful action. payload_hash is empty
// here — the staged row (written by the middleware) carries the canonical hash; this records outcome.
async function logExecuted(
  input: ExecuteModalSandboxActionInput,
  action: ModalSandboxActionName,
  status: "executed" | "failed",
  summary: string,
): Promise<void> {
  try {
    await logConnectorAction({
      businessId: input.userId,
      subAgentRunId: input.subAgentRunId ?? null,
      connector: MODAL_SANDBOX_CONNECTOR,
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
