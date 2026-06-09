// connectors/vercel/index.ts — the Vercel build connector entry point.
//
// Exposes the action list + per-action approval gate (for the approval middleware and UI), and the
// TS runner that performs an action against the Vercel REST API. Vercel is an IN-PROCESS connector
// (TypeScript + direct REST, like Slack / QuickBooks): a gated action fires here in the Next runtime
// the moment the owner approves — no Modal sub-agent makes the Vercel call.
//
// Per the Build Tools roadmap, a sub-agent never calls Vercel directly: it stages the action via the
// approval middleware (lib/orchestrator/tool-use.ts → stageConnectorAction, kind='build_action_approval'),
// which scope-checks it (ContainmentGuard) and writes the Inbox + approval + audit rows. The staged
// action fires when the owner approves and executeVercelConnectorAction (execute.ts) runs.

import { resolveVercelToken, markVercelConnectionError } from "@/lib/pa-vercel-connections";
import {
  createProjectAction,
  setEnvVarAction,
  triggerDeployAction,
  getDeploymentStatusAction,
  attachDomainAction,
  type VercelActionDescriptor,
} from "./actions";
import type { ActionExecOutcome, ApprovalGate, VercelActionMeta, VercelActionName } from "./types";

export const CONNECTOR = "vercel" as const;

// The descriptors keyed by name. `unknown` input type erases the per-action generic so they can sit
// in one map; each execute() re-validates its own payload with its schema before running.
const DESCRIPTORS: Record<VercelActionName, VercelActionDescriptor<unknown>> = {
  createProject: createProjectAction as VercelActionDescriptor<unknown>,
  setEnvVar: setEnvVarAction as VercelActionDescriptor<unknown>,
  triggerDeploy: triggerDeployAction as VercelActionDescriptor<unknown>,
  getDeploymentStatus: getDeploymentStatusAction as VercelActionDescriptor<unknown>,
  attachDomain: attachDomainAction as VercelActionDescriptor<unknown>,
};

// ── Action registry (meta only — safe to surface in the UI / scope lists) ──────────────────────
export const VERCEL_ACTIONS: readonly VercelActionMeta[] = (
  Object.values(DESCRIPTORS) as VercelActionDescriptor<unknown>[]
).map((a) => ({
  name: a.name,
  connector: CONNECTOR,
  action: a.action,
  description: a.description,
  gate: a.gate,
}));

const GATES: Record<VercelActionName, ApprovalGate> = {
  createProject: createProjectAction.gate,
  setEnvVar: setEnvVarAction.gate,
  triggerDeploy: triggerDeployAction.gate,
  getDeploymentStatus: getDeploymentStatusAction.gate,
  attachDomain: attachDomainAction.gate,
};

const KNOWN_ACTIONS = new Set<string>(Object.keys(GATES));

export function isVercelAction(action: string): action is VercelActionName {
  return KNOWN_ACTIONS.has(action);
}

export function vercelActionGate(action: VercelActionName): ApprovalGate {
  return GATES[action];
}

/** Read-only actions bypass the approval Inbox entirely. */
export function isVercelReadOnly(action: VercelActionName): boolean {
  return GATES[action] === "read";
}

/** Gated (approval-required) action names. */
export const VERCEL_WRITE_ACTIONS: readonly VercelActionName[] = (
  Object.keys(GATES) as VercelActionName[]
).filter((a) => GATES[a] === "gated");

// ── Execute against the Vercel API (payload validated per-action) ──────────────────────────────

function badPayload(message: string): ActionExecOutcome {
  return { ok: false, status: 422, error: message, authError: false };
}

/**
 * Validate `payload` with the action's own schema and run it. Pure with respect to PA state — it
 * only touches the Vercel API. Token + team come from the resolved connection (runVercelAction).
 */
export async function executeVercelAction(
  action: VercelActionName,
  args: { token: string; teamId: string | null; payload: Record<string, unknown> },
): Promise<ActionExecOutcome> {
  const descriptor = DESCRIPTORS[action];
  const parsed = descriptor.schema.safeParse(args.payload);
  if (!parsed.success) return badPayload(parsed.error.message);
  return descriptor.execute({ token: args.token, teamId: args.teamId }, parsed.data);
}

export type RunVercelResult =
  | { ok: true; summary: string; data: Record<string, unknown> }
  | { ok: false; status: number; error: string; reauth: boolean };

/**
 * Resolve the owner's Vercel connection + token, then execute the action. `reauth:true` signals the
 * caller to surface the reconnect path (a missing/revoked connection, or a token Vercel rejected).
 * On an auth error the connection is flipped to `error` so the Connections card nudges a reconnect.
 */
export async function runVercelAction(input: {
  userId: string;
  action: VercelActionName;
  payload: Record<string, unknown>;
}): Promise<RunVercelResult> {
  const resolved = await resolveVercelToken(input.userId);
  if (!resolved.ok) {
    return { ok: false, status: resolved.status, error: resolved.error, reauth: resolved.status === 409 };
  }

  const outcome = await executeVercelAction(input.action, {
    token: resolved.token,
    teamId: resolved.teamId,
    payload: input.payload,
  });
  if (!outcome.ok) {
    if (outcome.authError) {
      await markVercelConnectionError(input.userId);
      return { ok: false, status: outcome.status, error: outcome.error, reauth: true };
    }
    return { ok: false, status: outcome.status, error: outcome.error, reauth: false };
  }
  return { ok: true, summary: outcome.summary, data: outcome.data };
}

// Re-export the typed descriptors for unit tests that exercise the pure schema/gate logic.
export {
  createProjectAction,
  setEnvVarAction,
  triggerDeployAction,
  getDeploymentStatusAction,
  attachDomainAction,
};
