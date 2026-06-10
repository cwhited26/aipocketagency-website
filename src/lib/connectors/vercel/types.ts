// connectors/vercel/types.ts — shared types for the Vercel build connector.

/** Approval posture for a Vercel action. Reads bypass the Inbox; gated actions stage a card. */
export type ApprovalGate = "read" | "gated";

export const VERCEL_ACTION_NAMES = [
  "createProject",
  "setEnvVar",
  "setEnvVars",
  "triggerDeploy",
  "getDeploymentStatus",
  "attachDomain",
] as const;

export type VercelActionName = (typeof VERCEL_ACTION_NAMES)[number];

/** Meta surfaced to the UI / scope lists — never carries a token or payload. */
export type VercelActionMeta = {
  name: VercelActionName;
  connector: "vercel";
  action: VercelActionName;
  description: string;
  gate: ApprovalGate;
};

/**
 * Terminal outcome of executing one Vercel action against the API. `authError:true` means the
 * token is dead / unauthorized (401/403) — the caller flips the connection to `error` so the
 * owner is nudged to reconnect; it is never a silent failure.
 */
export type ActionExecOutcome =
  | { ok: true; summary: string; data: Record<string, unknown> }
  | { ok: false; status: number; error: string; authError: boolean };
