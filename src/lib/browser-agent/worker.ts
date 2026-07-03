// worker.ts — the tick engine behind /api/cron/browser-worker. Browser sessions run 30–60
// minutes; Vercel functions don't. So a job lives in pa_browser_jobs and every cron tick
// advances any leased live job a few steps: ask Computer Use for the next action, run it
// against the Browserbase session, screenshot, log the step + cost, save state, continue or
// park. Irreversible actions park the job as awaiting_approval behind a Mission Control card;
// the next tick after the owner's tap executes (or skips) the held action.
//
// Every effect is injected through WorkerDeps so the advance logic is unit-tested with no
// network, no browser, no DB (SPEC tests b + c).

import type { JobPatch } from "./db";
import type {
  AnthropicContentBlock,
  AnthropicMessage,
  BrowserJobRow,
  BrowserJobState,
  ElementInfo,
  PendingStep,
  PlannedAction,
} from "./types";
import { PendingStepSchema, actionKindOf, parseJobState } from "./types";
import {
  buildInitialMessages,
  planFromToolUse,
  pruneOldScreenshots,
  toolResultError,
  toolResultWithScreenshot,
  type ComputerUseResult,
} from "./computer-use";
import { classifyActionForApproval } from "./approval-gate";
import { evaluateCostCap, formatMicroCentsUsd, stepCostMicroCents } from "./cost";
import { WORKER_STEPS_PER_TICK } from "./constants";
import type { StepActionKind } from "./constants";

export type WorkerSession = {
  executeAction: (action: PlannedAction) => Promise<void>;
  hitTest: (x: number, y: number) => Promise<ElementInfo | null>;
  focusedElement: () => Promise<ElementInfo | null>;
  screenshot: () => Promise<string>;
  currentUrl: () => string;
  close: () => Promise<void>;
};

export type WorkerDeps = {
  updateJob: (jobId: string, patch: JobPatch) => Promise<{ ok: boolean }>;
  insertStep: (params: {
    jobId: string;
    ownerId: string;
    stepNumber: number;
    actionKind: StepActionKind;
    actionPayload: Record<string, unknown>;
    screenshotPath: string | null;
    reasoning: string | null;
    inboxItemId?: string | null;
    approvalStatus?: "pending" | "approved" | "rejected" | null;
  }) => Promise<{ ok: boolean }>;
  markStepApproval: (params: {
    jobId: string;
    stepNumber: number;
    approvalStatus: "approved" | "rejected";
  }) => Promise<void>;
  fetchInboxStatus: (inboxItemId: string) => Promise<"pending" | "approved" | "rejected" | "unknown">;
  stageApproval: (params: {
    ownerId: string;
    jobId: string;
    stepNumber: number;
    intent: string;
    action: PlannedAction;
    reasoning: string;
    pageUrl: string;
  }) => Promise<{ ok: true; inboxItemId: string } | { ok: false; error: string }>;
  callComputerUse: (params: {
    ownerId: string;
    messages: AnthropicMessage[];
  }) => Promise<ComputerUseResult>;
  createSession: (params: {
    timeoutSeconds: number;
  }) => Promise<{ ok: true; sessionId: string; connectUrl: string } | { ok: false; error: string }>;
  connectSession: (connectUrl: string) => Promise<WorkerSession>;
  releaseSession: (sessionId: string) => Promise<void>;
  storeScreenshot: (params: {
    ownerId: string;
    jobId: string;
    stepNumber: number;
    pngBase64: string;
  }) => Promise<{ ok: true; objectPath: string } | { ok: false; error: string }>;
  logStepCost: (params: {
    ownerId: string;
    jobId: string;
    stepNumber: number;
    tokensInput: number;
    tokensOutput: number;
    costMicroCents: number;
  }) => Promise<void>;
  now: () => number;
};

export type AdvanceOutcome = {
  jobId: string;
  status: string;
  stepsAdvanced: number;
  note: string;
};

function textOf(content: AnthropicContentBlock[]): string {
  return content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

function firstToolUse(
  content: AnthropicContentBlock[],
): { id: string; name: string; input: Record<string, unknown> } | null {
  for (const block of content) {
    if (block.type === "tool_use") return { id: block.id, name: block.name, input: block.input };
  }
  return null;
}

function describeAction(action: PlannedAction): string {
  switch (action.kind) {
    case "click":
      return `click at (${action.x}, ${action.y})`;
    case "type":
      return `type "${action.text.slice(0, 80)}"`;
    case "key":
      return `press ${action.text}`;
    case "navigate":
      return `open ${action.url}`;
    case "scroll":
      return `scroll ${action.direction}`;
    case "wait":
      return `wait ${action.seconds}s`;
    case "screenshot":
      return "take a screenshot";
  }
}

async function finishJob(
  deps: WorkerDeps,
  job: BrowserJobRow,
  state: BrowserJobState,
  patch: JobPatch,
): Promise<void> {
  await deps.updateJob(job.id, {
    ...patch,
    state_json: { ...state, messages: pruneOldScreenshots(state.messages) },
    completed_at: new Date().toISOString(),
    lease_until: null,
  });
  if (state.browserbase) await deps.releaseSession(state.browserbase.sessionId);
}

/** Advances one leased job as far as this tick's budget allows. Never throws — a failure
 *  lands on the job row as status='failed' with the error, not in the cron's logs alone. */
export async function advanceJob(
  job: BrowserJobRow,
  deps: WorkerDeps,
  budgetMs: number,
): Promise<AdvanceOutcome> {
  const tickStart = deps.now();
  const state = parseJobState(job.state_json);
  let stepsAdvanced = 0;
  let currentStep = job.current_step;
  let costMicroCents = job.cost_micro_cents_estimate;
  let status = job.status;
  let startedAtIso = job.started_at;

  const wallExceeded = (): boolean =>
    startedAtIso !== null && deps.now() - Date.parse(startedAtIso) > job.max_wall_seconds * 1_000;

  try {
    // ── queued → running: provision the session + first screenshot ─────────────────────
    if (status === "queued") {
      const created = await deps.createSession({ timeoutSeconds: job.max_wall_seconds + 600 });
      if (!created.ok) {
        await deps.updateJob(job.id, {
          status: "failed",
          error: `Could not start the browser session: ${created.error}`,
          completed_at: new Date().toISOString(),
          lease_until: null,
        });
        return { jobId: job.id, status: "failed", stepsAdvanced, note: created.error };
      }
      state.browserbase = { sessionId: created.sessionId, connectUrl: created.connectUrl };
      startedAtIso = new Date().toISOString();

      const session = await deps.connectSession(created.connectUrl);
      try {
        await session.executeAction({ kind: "navigate", url: job.starting_url });
        const shot = await session.screenshot();
        currentStep = 1;
        const stored = await deps.storeScreenshot({
          ownerId: job.owner_id,
          jobId: job.id,
          stepNumber: currentStep,
          pngBase64: shot,
        });
        await deps.insertStep({
          jobId: job.id,
          ownerId: job.owner_id,
          stepNumber: currentStep,
          actionKind: "navigate",
          actionPayload: { url: job.starting_url },
          screenshotPath: stored.ok ? stored.objectPath : null,
          reasoning: "Opened the starting page.",
        });
        state.messages = buildInitialMessages({
          intent: job.intent,
          startingUrl: job.starting_url,
          firstScreenshotBase64: shot,
        });
        status = "running";
        stepsAdvanced += 1;
        await deps.updateJob(job.id, {
          status,
          current_step: currentStep,
          browserbase_session_id: created.sessionId,
          started_at: startedAtIso,
          state_json: { ...state, messages: pruneOldScreenshots(state.messages) },
        });
      } finally {
        await session.close();
      }
      // Fall through to the running loop on the same tick if budget remains.
    }

    // ── awaiting_approval: has the owner tapped? ────────────────────────────────────────
    let approvedPending: PendingStep | null = null;
    let rejectedPending: PendingStep | null = null;
    if (status === "awaiting_approval") {
      const pendingParse = PendingStepSchema.safeParse(job.pending_step);
      if (!pendingParse.success) {
        await deps.updateJob(job.id, {
          status: "failed",
          error: "The held step's record was unreadable — canceling rather than guessing at an approved action.",
          completed_at: new Date().toISOString(),
          lease_until: null,
        });
        return { jobId: job.id, status: "failed", stepsAdvanced, note: "pending_step unreadable" };
      }
      const pending = pendingParse.data;
      const inboxStatus = await deps.fetchInboxStatus(pending.inboxItemId);
      if (inboxStatus === "pending" || inboxStatus === "unknown") {
        await deps.updateJob(job.id, { lease_until: null });
        return { jobId: job.id, status, stepsAdvanced, note: "still awaiting the owner" };
      }
      if (inboxStatus === "approved") approvedPending = pending;
      else rejectedPending = pending;
      await deps.markStepApproval({
        jobId: job.id,
        stepNumber: pending.stepNumber,
        approvalStatus: inboxStatus,
      });
      status = "running";
    }

    if (status !== "running") {
      await deps.updateJob(job.id, { lease_until: null });
      return { jobId: job.id, status, stepsAdvanced, note: "nothing to do" };
    }
    if (!state.browserbase) {
      await deps.updateJob(job.id, {
        status: "failed",
        error: "The job lost its browser session record.",
        completed_at: new Date().toISOString(),
        lease_until: null,
      });
      return { jobId: job.id, status: "failed", stepsAdvanced, note: "no session in state" };
    }

    // ── the running loop ────────────────────────────────────────────────────────────────
    const session = await deps.connectSession(state.browserbase.connectUrl);
    const browserWindowStart = deps.now();
    try {
      // Resolve a held step first (approved → execute it; rejected → tell the model).
      if (approvedPending) {
        // pending_step.action stores the normalized PlannedAction — execute it directly.
        const action = approvedPending.action as unknown as PlannedAction;
        await session.executeAction(action);
        const shot = await session.screenshot();
        currentStep += 1;
        const stored = await deps.storeScreenshot({
          ownerId: job.owner_id,
          jobId: job.id,
          stepNumber: currentStep,
          pngBase64: shot,
        });
        await deps.insertStep({
          jobId: job.id,
          ownerId: job.owner_id,
          stepNumber: currentStep,
          actionKind: actionKindOf(action),
          actionPayload: { ...approvedPending.action, approved: true },
          screenshotPath: stored.ok ? stored.objectPath : null,
          reasoning: approvedPending.reasoning,
        });
        state.messages.push({
          role: "user",
          content: [
            toolResultWithScreenshot({
              toolUseId: approvedPending.toolUseId,
              note: `The owner approved. Executed: ${describeAction(action)}. Current page: ${session.currentUrl()}`,
              screenshotBase64: shot,
            }),
          ],
        });
        stepsAdvanced += 1;
      } else if (rejectedPending) {
        const shot = await session.screenshot();
        state.messages.push({
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: rejectedPending.toolUseId,
              is_error: true,
              content: [
                {
                  type: "text",
                  text: "The owner REJECTED this action. Do not attempt it again. Find another way to make progress, or wrap up with a summary of where things stand.",
                },
                ...(shot
                  ? ([
                      {
                        type: "image" as const,
                        source: { type: "base64" as const, media_type: "image/png" as const, data: shot },
                      },
                    ] as const)
                  : []),
              ],
            },
          ],
        });
      }

      // Plan → gate → execute, up to the per-tick step budget.
      for (let i = 0; i < WORKER_STEPS_PER_TICK; i++) {
        if (deps.now() - tickStart > budgetMs) break;

        if (currentStep >= job.max_steps) {
          const accrued = state.browserSecondsAccrued + (deps.now() - browserWindowStart) / 1_000;
          await finishJob(deps, job, { ...state, browserSecondsAccrued: accrued }, {
            status: "failed",
            current_step: currentStep,
            cost_micro_cents_estimate: costMicroCents,
            error: `Step limit reached (${job.max_steps}). Raise Max steps and start a new job if it needs more room.`,
          });
          return { jobId: job.id, status: "failed", stepsAdvanced, note: "max steps" };
        }
        if (wallExceeded()) {
          const accrued = state.browserSecondsAccrued + (deps.now() - browserWindowStart) / 1_000;
          await finishJob(deps, job, { ...state, browserSecondsAccrued: accrued }, {
            status: "failed",
            current_step: currentStep,
            cost_micro_cents_estimate: costMicroCents,
            error: `Time budget reached (${job.max_wall_seconds}s).`,
          });
          return { jobId: job.id, status: "failed", stepsAdvanced, note: "wall clock" };
        }
        const cap = evaluateCostCap({
          spentMicroCents: costMicroCents,
          maxCostMicroCents: job.max_cost_micro_cents,
        });
        if (!cap.ok) {
          const accrued = state.browserSecondsAccrued + (deps.now() - browserWindowStart) / 1_000;
          await finishJob(deps, job, { ...state, browserSecondsAccrued: accrued }, {
            status: "failed",
            current_step: currentStep,
            cost_micro_cents_estimate: costMicroCents,
            error: cap.reason,
          });
          return { jobId: job.id, status: "failed", stepsAdvanced, note: "cost cap" };
        }

        const planCallStart = deps.now();
        const result = await deps.callComputerUse({
          ownerId: job.owner_id,
          messages: state.messages,
        });
        if (!result.ok) {
          const accrued = state.browserSecondsAccrued + (deps.now() - browserWindowStart) / 1_000;
          await finishJob(deps, job, { ...state, browserSecondsAccrued: accrued }, {
            status: "failed",
            current_step: currentStep,
            cost_micro_cents_estimate: costMicroCents,
            error: `Planning call failed: ${result.error}`,
          });
          return { jobId: job.id, status: "failed", stepsAdvanced, note: "anthropic error" };
        }

        // Cost: this planning call + the browser seconds since the last accounting point.
        const browserSeconds = (deps.now() - planCallStart) / 1_000;
        const added = stepCostMicroCents({
          tokensInput: result.usage.input_tokens,
          tokensOutput: result.usage.output_tokens,
          browserSeconds,
        });
        costMicroCents += added;
        await deps.logStepCost({
          ownerId: job.owner_id,
          jobId: job.id,
          stepNumber: currentStep + 1,
          tokensInput: result.usage.input_tokens,
          tokensOutput: result.usage.output_tokens,
          costMicroCents: added,
        });

        state.messages.push({ role: "assistant", content: result.content });
        const toolUse = firstToolUse(result.content);
        const reasoning = textOf(result.content);

        // No tool call → the model is done; its text is the mission report.
        if (!toolUse) {
          const accrued = state.browserSecondsAccrued + (deps.now() - browserWindowStart) / 1_000;
          await finishJob(deps, job, { ...state, browserSecondsAccrued: accrued }, {
            status: "completed",
            current_step: currentStep,
            cost_micro_cents_estimate: costMicroCents,
            result_summary: reasoning || "Done.",
          });
          return { jobId: job.id, status: "completed", stepsAdvanced, note: "model finished" };
        }

        const planned = planFromToolUse(toolUse.name, toolUse.input);
        if (!planned.ok) {
          state.messages.push({
            role: "user",
            content: [toolResultError(toolUse.id, planned.error)],
          });
          continue; // the model retries with a supported action
        }
        const action = planned.action;

        // The approval gate: hit-test what the action touches, then classify.
        let element: ElementInfo | null = null;
        if (action.kind === "click" || action.kind === "scroll") {
          element = await session.hitTest(action.x, action.y).catch(() => null);
        } else if (action.kind === "type" || action.kind === "key") {
          element = await session.focusedElement().catch(() => null);
        }
        const decision = classifyActionForApproval({
          action,
          element,
          currentUrl: session.currentUrl(),
        });

        if (decision.requiresApproval) {
          const shot = await session.screenshot();
          currentStep += 1;
          const stored = await deps.storeScreenshot({
            ownerId: job.owner_id,
            jobId: job.id,
            stepNumber: currentStep,
            pngBase64: shot,
          });
          const staged = await deps.stageApproval({
            ownerId: job.owner_id,
            jobId: job.id,
            stepNumber: currentStep,
            intent: job.intent,
            action,
            reasoning: `${decision.reason}${reasoning ? `\n\nAgent's plan: ${reasoning.slice(0, 500)}` : ""}`,
            pageUrl: session.currentUrl(),
          });
          if (!staged.ok) {
            const accrued = state.browserSecondsAccrued + (deps.now() - browserWindowStart) / 1_000;
            await finishJob(deps, job, { ...state, browserSecondsAccrued: accrued }, {
              status: "failed",
              current_step: currentStep,
              cost_micro_cents_estimate: costMicroCents,
              error: `Could not stage the approval card: ${staged.error}`,
            });
            return { jobId: job.id, status: "failed", stepsAdvanced, note: "stage failed" };
          }
          await deps.insertStep({
            jobId: job.id,
            ownerId: job.owner_id,
            stepNumber: currentStep,
            actionKind: "awaiting_approval",
            actionPayload: { ...action, gateReason: decision.reason },
            screenshotPath: stored.ok ? stored.objectPath : null,
            reasoning,
            inboxItemId: staged.inboxItemId,
            approvalStatus: "pending",
          });
          const accrued = state.browserSecondsAccrued + (deps.now() - browserWindowStart) / 1_000;
          const pending: PendingStep = {
            stepNumber: currentStep,
            inboxItemId: staged.inboxItemId,
            toolUseId: toolUse.id,
            action: action as unknown as Record<string, unknown>,
            reasoning: reasoning || decision.reason,
          };
          await deps.updateJob(job.id, {
            status: "awaiting_approval",
            current_step: currentStep,
            cost_micro_cents_estimate: costMicroCents,
            pending_step: pending,
            state_json: {
              ...state,
              browserSecondsAccrued: accrued,
              messages: pruneOldScreenshots(state.messages),
            },
            lease_until: null,
          });
          return {
            jobId: job.id,
            status: "awaiting_approval",
            stepsAdvanced,
            note: describeAction(action),
          };
        }

        // Pass-through action: execute, screenshot, record, feed back.
        try {
          await session.executeAction(action);
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          state.messages.push({
            role: "user",
            content: [toolResultError(toolUse.id, `The action failed in the browser: ${message.slice(0, 300)}`)],
          });
          continue;
        }
        const shot = await session.screenshot();
        currentStep += 1;
        stepsAdvanced += 1;
        const stored = await deps.storeScreenshot({
          ownerId: job.owner_id,
          jobId: job.id,
          stepNumber: currentStep,
          pngBase64: shot,
        });
        await deps.insertStep({
          jobId: job.id,
          ownerId: job.owner_id,
          stepNumber: currentStep,
          actionKind: actionKindOf(action),
          actionPayload: action as unknown as Record<string, unknown>,
          screenshotPath: stored.ok ? stored.objectPath : null,
          reasoning,
        });
        state.messages.push({
          role: "user",
          content: [
            toolResultWithScreenshot({
              toolUseId: toolUse.id,
              note: `Executed: ${describeAction(action)}. Current page: ${session.currentUrl()}`,
              screenshotBase64: shot,
            }),
          ],
        });

        // Persist progress every step so a dead tick resumes cleanly.
        const accrued = state.browserSecondsAccrued + (deps.now() - browserWindowStart) / 1_000;
        await deps.updateJob(job.id, {
          status: "running",
          current_step: currentStep,
          cost_micro_cents_estimate: costMicroCents,
          state_json: {
            ...state,
            browserSecondsAccrued: accrued,
            messages: pruneOldScreenshots(state.messages),
          },
        });
      }

      // Budget spent — park until the next tick.
      const accrued = state.browserSecondsAccrued + (deps.now() - browserWindowStart) / 1_000;
      await deps.updateJob(job.id, {
        status: "running",
        current_step: currentStep,
        cost_micro_cents_estimate: costMicroCents,
        state_json: {
          ...state,
          browserSecondsAccrued: accrued,
          messages: pruneOldScreenshots(state.messages),
        },
        lease_until: null,
      });
      return { jobId: job.id, status: "running", stepsAdvanced, note: "tick budget spent" };
    } finally {
      await session.close();
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[browser-agent/worker] tick failed", { jobId: job.id, error: message });
    await deps.updateJob(job.id, {
      status: "failed",
      error: `Worker error: ${message.slice(0, 400)} (spent so far: ${formatMicroCentsUsd(costMicroCents)})`,
      cost_micro_cents_estimate: costMicroCents,
      completed_at: new Date().toISOString(),
      lease_until: null,
    });
    if (state.browserbase) await deps.releaseSession(state.browserbase.sessionId);
    return { jobId: job.id, status: "failed", stepsAdvanced, note: message.slice(0, 120) };
  }
}
