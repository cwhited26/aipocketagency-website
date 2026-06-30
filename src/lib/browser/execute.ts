// execute.ts — the one place a browser_* tool actually runs against Chromium. Called from two entry
// points, identically:
//   1. stage.ts auto-approve path (domain on the allowlist + Trust-Ladder-unlocked) — runs immediately.
//   2. the Mission Control approval route, when the owner taps Approve on a browser_action_approval card.
//
// It validates the staged payload, runs the tool in the concurrency pool, stores any screenshot,
// writes the cost-ledger row, and flips the pre-created pa_browser_actions row to executed/failed.
// Returns the connector-result shape the approvals route + registry consume.

import { logCostFromUsage } from "@/lib/cost/log";
import { BROWSER_TOOLS, BROWSER_CONNECTOR } from "./registry";
import { runInPool } from "./playwright-pool";
import { storeScreenshot } from "./screenshots";
import { updateBrowserAction } from "./actions-db";
import { isBrowserToolName, type ToolOutput } from "./types";
import { BROWSER_COST_FEATURE_SLUG } from "./constants";
import { browserLog } from "./log";

export type BrowserExecuteResult =
  | { ok: true; summary: string; data: Record<string, unknown> }
  | { ok: false; status: number; error: string };

/** The shape stage.ts stores in the approval payload + hands to executeBrowserAction. */
export type StagedBrowserPayload = {
  tool: string;
  input: Record<string, unknown>;
  browserActionId: string;
};

function parseStagedPayload(payload: Record<string, unknown>): StagedBrowserPayload | null {
  const tool = payload.tool;
  const input = payload.input;
  const browserActionId = payload.browserActionId;
  if (typeof tool !== "string" || typeof browserActionId !== "string" || typeof input !== "object" || input === null) {
    return null;
  }
  return { tool, input: input as Record<string, unknown>, browserActionId };
}

export type ExecuteBrowserActionInput = {
  userId: string;
  /** The tool name (== the connector action). */
  action: string;
  /** The staged payload: { tool, input, browserActionId }. */
  payload: Record<string, unknown>;
  /** True when this run came from a manual owner Approve (drives the Trust-Ladder count). */
  approvedManually?: boolean;
};

/**
 * Run one staged browser action. The pa_browser_actions row referenced by payload.browserActionId
 * must already exist (stage.ts creates it). This function flips it to executed/failed and never
 * throws — failures come back as { ok: false }.
 */
export async function executeBrowserAction(input: ExecuteBrowserActionInput): Promise<BrowserExecuteResult> {
  const staged = parseStagedPayload(input.payload);
  if (!staged) {
    return { ok: false, status: 400, error: "Malformed browser action payload" };
  }
  if (!isBrowserToolName(staged.tool)) {
    return { ok: false, status: 400, error: `Unknown browser tool "${staged.tool}"` };
  }
  const tool = BROWSER_TOOLS[staged.tool];

  // Re-validate the input at execution time — never trust a stored payload blindly.
  const parsed = tool.schema.safeParse(staged.input);
  if (!parsed.success) {
    await updateBrowserAction(staged.browserActionId, {
      status: "failed",
      error: `Invalid input: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
    });
    return { ok: false, status: 400, error: "Invalid browser tool input" };
  }

  const startedAt = Date.now();
  const run = await runInPool<ToolOutput>(staged.tool, (page) => tool.handler(page, parsed.data as never));
  const elapsedSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));

  // Every executed run is metered — the compute happened whether it succeeded or not.
  await logCostFromUsage(
    {
      ownerId: input.userId,
      featureSlug: BROWSER_COST_FEATURE_SLUG,
      idempotencyKey: `browser-action:${staged.browserActionId}`,
      metadata: { tool: staged.tool, outcome: run.ok ? "executed" : "failed" },
    },
    "vercel",
    null,
    { cpuSeconds: elapsedSeconds },
  );

  if (!run.ok) {
    await updateBrowserAction(staged.browserActionId, {
      status: "failed",
      error: run.error,
      approvedManually: input.approvedManually ?? undefined,
    });
    browserLog.warn("browser action failed", { connector: BROWSER_CONNECTOR, tool: staged.tool, actionId: staged.browserActionId, error: run.error });
    return { ok: false, status: 502, error: run.error };
  }

  // Store the screenshot (if any) before recording the row, so screenshot_url is set atomically with executed.
  let screenshotUrl: string | null = null;
  if (run.value.screenshotBase64) {
    const stored = await storeScreenshot({
      ownerId: input.userId,
      actionId: staged.browserActionId,
      pngBase64: run.value.screenshotBase64,
    });
    if (stored.ok) screenshotUrl = stored.objectPath; // store the path; the log page signs a fresh URL per render
  }

  await updateBrowserAction(staged.browserActionId, {
    status: "executed",
    resultJson: run.value.data,
    screenshotUrl,
    error: null,
    approvedManually: input.approvedManually ?? undefined,
  });

  browserLog.info("browser action executed", { tool: staged.tool, actionId: staged.browserActionId, elapsedSeconds });
  return { ok: true, summary: run.value.summary, data: run.value.data };
}
