// tool-use.ts — the approval-gate middleware every connector write passes through (SPEC v5
// §9.3, §9.4) plus the action-path ContainmentGuard (PA-ORCH-9). A sub-agent never calls a
// connector directly: it stages the action here, which (1) checks the action is inside the
// sub-agent's declared scopes — fail closed — and (2) writes a pa_inbox_items row
// (kind='action_approval') + a pa_action_approvals detail row + a staged audit-log row. The
// action fires only after the owner approves (or an unlocked auto-approve toggle fires it).
//
// The scope check + the state machine are pure and synchronous so they're exhaustively
// unit-tested (positive + negative cases) without a DB.

import { createHash } from "node:crypto";
import { createInboxItem } from "@/lib/pa-inbox-items";
import {
  fetchAutoApproveSetting,
  insertActionApproval,
  logConnectorAction,
} from "./db";
import { assertActionAllowed } from "./containment-guard";
import { AUTO_APPROVE_TRUST_WINDOW } from "./tier-caps";
import type { ActionStatus } from "./types";

// The action-path ContainmentGuard (scope matching + ConnectorScopeError) is the single
// canonical implementation in ./containment-guard. Re-exported here so existing callers that
// import the scope error from the middleware keep working.
export { ConnectorScopeError, isActionAllowed, assertActionAllowed, scopeToken } from "./containment-guard";

// ── Action-approval state machine ───────────────────────────────────────────────────────

export type ActionEvent = "approve" | "reject" | "execute" | "fail";

/**
 * Pure transition for a staged connector action. Returns the next status, or null for an
 * illegal transition (e.g. approving an already-executed action). Terminal: executed,
 * rejected, failed.
 */
export function nextActionStatus(
  current: ActionStatus,
  event: ActionEvent,
): ActionStatus | null {
  switch (current) {
    case "staged":
      if (event === "approve") return "approved";
      if (event === "reject") return "rejected";
      if (event === "fail") return "failed";
      return null;
    case "approved":
      if (event === "execute") return "executed";
      if (event === "fail") return "failed";
      if (event === "reject") return "rejected";
      return null;
    case "executed":
    case "rejected":
    case "failed":
      return null; // terminal
    default:
      return null;
  }
}

// ── Payload hashing (audit trail without storing the raw payload long-term) ─────────────

export function payloadHash(payload: unknown): string {
  const json = JSON.stringify(payload ?? {});
  return createHash("sha256").update(json).digest("hex").slice(0, 32);
}

// ── Staging ─────────────────────────────────────────────────────────────────────────────

export type StageActionInput = {
  userId: string;
  subAgentRunId: string | null;
  connector: string;
  action: string;
  payload: Record<string, unknown>;
  // The scopes the run was granted; the action MUST be inside them (fail closed).
  declaredScopes: readonly string[];
  // Human-readable one-line summary of what the action does (rendered on the card).
  title: string;
  // A longer preview of the action's effect (e.g. the email subject + body).
  preview: string;
};

export type StageActionResult = {
  inboxItemId: string;
  actionApprovalId: string;
  connectorActionLogId: string;
  // True when an unlocked auto-approve toggle means this action does NOT need a manual tap.
  autoApproved: boolean;
};

/**
 * Stages a connector action for approval. Throws ConnectorScopeError BEFORE any DB write when
 * the action is out of scope. Otherwise creates the inbox row, the approval detail, and the
 * staged audit row, and reports whether the owner's auto-approve toggle pre-clears it.
 */
export async function stageConnectorAction(
  input: StageActionInput,
): Promise<StageActionResult> {
  // 1. Fail closed on scope — before touching the DB.
  assertActionAllowed(input.connector, input.action, input.declaredScopes);

  // 2. Auto-approve eligibility (the toggle only flips on after the trust window; the
  //    settings route enforces the unlock, so reading `enabled` here is sufficient).
  const setting = await fetchAutoApproveSetting(
    input.userId,
    input.connector,
    input.action,
  );
  const autoApproved = setting?.enabled === true;

  // 3. Inbox row drives the queue + badge.
  const inbox = await createInboxItem({
    userId: input.userId,
    kind: "action_approval",
    title: input.title,
    bodyMd: input.preview,
    source: `orchestrator:${input.connector}`,
    payload: {
      connector: input.connector,
      action: input.action,
      preview: input.preview,
      subAgentRunId: input.subAgentRunId,
    },
  });
  if (!inbox.ok) {
    throw new Error(`Could not stage action: ${inbox.error}`);
  }

  // 4. Detail row holds the executable payload + run linkage.
  const approval = await insertActionApproval({
    inboxItemId: inbox.data.id,
    businessId: input.userId,
    subAgentRunId: input.subAgentRunId,
    connector: input.connector,
    action: input.action,
    payload: input.payload,
    autoApproveEligible: autoApproved,
  });

  // 5. Audit log (staged). approve/execute transitions update this row.
  const log = await logConnectorAction({
    businessId: input.userId,
    subAgentRunId: input.subAgentRunId,
    connector: input.connector,
    action: input.action,
    payloadHash: payloadHash(input.payload),
    status: "staged",
  });

  return {
    inboxItemId: inbox.data.id,
    actionApprovalId: approval.id,
    connectorActionLogId: log.id,
    autoApproved,
  };
}

// Number of successful manual approvals of an action type before the auto-approve toggle
// unlocks (PA-ORCH-4 trust window). The canonical constant lives in ./tier-caps; re-exported
// here for the callers that reach for it via the middleware.
export const TRUST_WINDOW = AUTO_APPROVE_TRUST_WINDOW;
