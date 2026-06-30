// stage.ts — the gate pipeline every browser_* tool call passes through before it can touch the
// browser (prompt items 5 + 10). This is what the dispatcher/agent calls to invoke a tool. Order is
// load-bearing and fail-closed:
//
//   1. validate the tool + input (zod)            — malformed never reaches the browser
//   2. refuse list (hardcoded)                    — forbidden domain / money-movement → 'refused', no run
//   3. tier monthly cap                           — over budget → 'blocked', no run
//   4. per-domain permission + Trust Ladder        — 'deny' → blocked; 'auto' → run now; else stage a card
//
// Every outcome writes exactly one pa_browser_actions row so the audit log never silently drops an
// attempt. Auto-approved runs execute inline; gated ones stage a browser_action_approval Mission
// Control card that the existing approval route fires on Approve.

import { stageConnectorAction } from "@/lib/orchestrator/tool-use";
import { BROWSER_TOOLS, BROWSER_CONNECTOR } from "./registry";
import { isBrowserToolName, type BrowserToolName } from "./types";
import { evaluateRefuse } from "./refuse-list";
import { evaluateBrowserActionCap } from "./tier";
import { resolveDomainDecision } from "./trust-ladder";
import { domainOf } from "./domains";
import {
  insertBrowserAction,
  updateBrowserAction,
  countActionsThisMonth,
  countManualApprovalsForDomain,
} from "./actions-db";
import { fetchDomainPermission } from "./permissions-db";
import { executeBrowserAction, type BrowserExecuteResult } from "./execute";
import { browserLog } from "./log";
import type { Tier } from "@/lib/personas/tier-caps";

export type StageBrowserToolInput = {
  userId: string;
  tier: Tier;
  tool: string;
  input: Record<string, unknown>;
  personaId?: string | null;
  taskId?: string | null;
  subAgentRunId?: string | null;
};

export type StageBrowserToolResult =
  | { kind: "invalid"; error: string }
  | { kind: "refused"; reason: string; actionId: string }
  | { kind: "blocked"; reason: string; actionId: string }
  | { kind: "executed"; actionId: string; result: BrowserExecuteResult }
  | { kind: "staged"; actionId: string; inboxItemId: string };

function pluckTextSurfaces(input: Record<string, unknown>): { url: string; selector: string | null; text: string | null } {
  const url = typeof input.url === "string" ? input.url : "";
  const selector = typeof input.selector === "string" ? input.selector : null;
  const text = typeof input.text === "string" ? input.text : null;
  return { url, selector, text };
}

function cardTitle(tool: BrowserToolName, domain: string | null): string {
  return `Browser action: ${tool}${domain ? ` on ${domain}` : ""}`;
}

function cardPreview(tool: BrowserToolName, surfaces: { url: string; selector: string | null; text: string | null }): string {
  const lines = [`PA wants to run **${tool}** in an isolated headless browser.`, `Target: ${surfaces.url}`];
  if (surfaces.selector) lines.push(`Selector: \`${surfaces.selector}\``);
  if (surfaces.text) lines.push(`Text: ${surfaces.text.slice(0, 120)}`);
  return lines.join("\n");
}

export async function stageBrowserToolCall(params: StageBrowserToolInput): Promise<StageBrowserToolResult> {
  // 1 · Validate the tool + input.
  if (!isBrowserToolName(params.tool)) {
    return { kind: "invalid", error: `Unknown browser tool "${params.tool}"` };
  }
  const tool = BROWSER_TOOLS[params.tool];
  const parsed = tool.schema.safeParse(params.input);
  if (!parsed.success) {
    return { kind: "invalid", error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const validInput = parsed.data as Record<string, unknown>;
  const surfaces = pluckTextSurfaces(validInput);
  const domain = domainOf(surfaces.url);

  const baseRow = {
    ownerId: params.userId,
    personaId: params.personaId ?? null,
    taskId: params.taskId ?? null,
    action: params.tool,
    targetUrl: surfaces.url || null,
    domain,
    selector: surfaces.selector,
    payloadJson: { tool: params.tool, input: validInput },
  };

  // 2 · Hardcoded refuse list (forbidden domain / money-movement). Records, never runs, never stages.
  const refuse = evaluateRefuse({ url: surfaces.url, selector: surfaces.selector, text: surfaces.text });
  if (refuse.refused) {
    const row = await insertBrowserAction({ ...baseRow, status: "refused", error: refuse.detail });
    browserLog.warn("browser action refused", { tool: params.tool, family: refuse.family, domain });
    return { kind: "refused", reason: refuse.detail, actionId: row.ok ? row.data.id : "" };
  }

  // 3 · Tier monthly cap.
  const used = await countActionsThisMonth(params.userId);
  const cap = evaluateBrowserActionCap(params.tier, used);
  if (!cap.ok) {
    const row = await insertBrowserAction({ ...baseRow, status: "blocked", error: cap.reason });
    return { kind: "blocked", reason: cap.reason, actionId: row.ok ? row.data.id : "" };
  }

  // 4 · Per-domain permission + Trust Ladder.
  const permRes = domain ? await fetchDomainPermission(params.userId, domain) : null;
  const permission = permRes && permRes.ok ? permRes.data : null;
  const manualApprovals = domain ? await countManualApprovalsForDomain(params.userId, domain) : 0;
  const decision = resolveDomainDecision(permission, manualApprovals);

  if (decision === "deny") {
    const row = await insertBrowserAction({
      ...baseRow,
      status: "blocked",
      error: `Domain ${domain} is on your deny list.`,
    });
    return { kind: "blocked", reason: `Domain ${domain} is denied in your browser permissions.`, actionId: row.ok ? row.data.id : "" };
  }

  // Create the pending row up front so both paths reference the same audit/ledger id.
  const inserted = await insertBrowserAction({ ...baseRow, status: "pending_approval" });
  if (!inserted.ok) {
    return { kind: "invalid", error: `Could not record the browser action: ${inserted.error}` };
  }
  const actionId = inserted.data.id;
  const stagedPayload = { tool: params.tool, input: validInput, browserActionId: actionId };

  // 4a · Auto-approve (allowlisted + Trust-Ladder-unlocked) — run inline now.
  if (decision === "auto") {
    const result = await executeBrowserAction({
      userId: params.userId,
      action: params.tool,
      payload: stagedPayload,
      approvedManually: false,
    });
    return { kind: "executed", actionId, result };
  }

  // 4b · Manual — stage a browser_action_approval card via the existing approval plumbing.
  const staged = await stageConnectorAction({
    userId: params.userId,
    subAgentRunId: params.subAgentRunId ?? null,
    connector: BROWSER_CONNECTOR,
    action: params.tool,
    payload: stagedPayload,
    declaredScopes: [`${BROWSER_CONNECTOR}:*`],
    title: cardTitle(params.tool, domain),
    preview: cardPreview(params.tool, surfaces),
    kind: "browser_action_approval",
  });
  await updateBrowserAction(actionId, { inboxItemId: staged.inboxItemId });
  return { kind: "staged", actionId, inboxItemId: staged.inboxItemId };
}
