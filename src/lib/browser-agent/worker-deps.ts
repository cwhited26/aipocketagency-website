// worker-deps.ts — the production WorkerDeps wiring: real Browserbase, real CDP driver, real
// Anthropic, real DB, real Mission Control staging, real cost ledger. The worker itself stays
// pure; this file is the only place the effects meet.

import { fetchPaUser } from "@/lib/pa-supabase";
import { fetchInboxItemById } from "@/lib/pa-inbox-items";
import { stageConnectorAction } from "@/lib/orchestrator/tool-use";
import { logCostEvent } from "@/lib/cost/log";
import {
  createBrowserbaseSession,
  releaseBrowserbaseSession,
} from "@/modules/integrations/browserbase/adapter";
import {
  connectToSession,
  currentUrl,
  executeAction,
  focusedElement,
  hitTest,
  takeScreenshot,
} from "./driver";
import { callComputerUse } from "./computer-use";
import { storeJobScreenshot } from "./screenshots";
import { insertBrowserStep, updateBrowserJob, updateBrowserStepApproval } from "./db";
import {
  BROWSER_AGENT_APPROVAL_ACTION,
  BROWSER_AGENT_CONNECTOR,
  BROWSER_AGENT_COST_FEATURE_SLUG,
  BROWSER_AGENT_MODEL,
} from "./constants";
import type { PlannedAction } from "./types";
import type { WorkerDeps } from "./worker";

function describeForCard(action: PlannedAction): string {
  switch (action.kind) {
    case "click":
      return "click a control";
    case "type":
      return "type into a field";
    case "key":
      return `press ${action.text}`;
    case "navigate":
      return `open ${action.url}`;
    case "scroll":
      return "scroll the page";
    case "wait":
      return "wait";
    case "screenshot":
      return "take a screenshot";
  }
}

/** Resolves the Anthropic key: the owner's BYO key first (their key, their bill — the Apps
 *  contract), then the platform key as fallback. */
async function anthropicKeyFor(ownerId: string): Promise<string | null> {
  const pa = await fetchPaUser(ownerId);
  const byo = pa.ok && pa.data ? pa.data.anthropic_api_key : null;
  return byo || process.env.ANTHROPIC_API_KEY || null;
}

export function makeWorkerDeps(): WorkerDeps {
  return {
    updateJob: async (jobId, patch) => {
      const res = await updateBrowserJob(jobId, patch);
      if (!res.ok) {
        console.error("[browser-agent/worker-deps] job update failed", { jobId, error: res.error });
      }
      return { ok: res.ok };
    },
    insertStep: async (params) => {
      const res = await insertBrowserStep({
        jobId: params.jobId,
        ownerId: params.ownerId,
        stepNumber: params.stepNumber,
        actionKind: params.actionKind,
        actionPayload: params.actionPayload,
        screenshotPath: params.screenshotPath,
        reasoning: params.reasoning,
        inboxItemId: params.inboxItemId ?? null,
        approvalStatus: params.approvalStatus ?? null,
      });
      if (!res.ok) {
        console.error("[browser-agent/worker-deps] step insert failed", {
          jobId: params.jobId,
          stepNumber: params.stepNumber,
          error: res.error,
        });
      }
      return { ok: res.ok };
    },
    markStepApproval: async (params) => {
      const res = await updateBrowserStepApproval(params);
      if (!res.ok) {
        console.warn("[browser-agent/worker-deps] step approval mark failed", {
          jobId: params.jobId,
          error: res.error,
        });
      }
    },
    fetchInboxStatus: async (inboxItemId) => {
      const res = await fetchInboxItemById(inboxItemId);
      if (!res.ok || !res.data) return "unknown";
      const status = res.data.status;
      if (status === "pending" || status === "approved" || status === "rejected") return status;
      // Dismissed / expired cards read as rejected — the held action must not run.
      return "rejected";
    },
    stageApproval: async (params) => {
      try {
        const staged = await stageConnectorAction({
          userId: params.ownerId,
          subAgentRunId: null,
          connector: BROWSER_AGENT_CONNECTOR,
          action: BROWSER_AGENT_APPROVAL_ACTION,
          payload: {
            jobId: params.jobId,
            stepNumber: params.stepNumber,
            action: params.action as unknown as Record<string, unknown>,
            pageUrl: params.pageUrl,
          },
          declaredScopes: [`${BROWSER_AGENT_CONNECTOR}:*`],
          title: `Browser Agent wants to ${describeForCard(params.action)}`,
          preview: [
            `**Task:** ${params.intent.slice(0, 300)}`,
            `**Page:** ${params.pageUrl}`,
            `**Held action:** ${describeForCard(params.action)}`,
            "",
            params.reasoning,
            "",
            `Approve to run this one step, or reject and the agent finds another way. The step-by-step record (with screenshots) is on the job page.`,
          ].join("\n"),
          kind: "browser_action_approval",
        });
        return { ok: true, inboxItemId: staged.inboxItemId };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
    callComputerUse: async (params) => {
      const key = await anthropicKeyFor(params.ownerId);
      if (!key) {
        return {
          ok: false,
          error: "No Anthropic API key — add yours in Settings, or set the platform key.",
        };
      }
      return callComputerUse({ apiKey: key, messages: params.messages });
    },
    createSession: async (params) => {
      const res = await createBrowserbaseSession({ timeoutSeconds: params.timeoutSeconds });
      if (!res.ok) return { ok: false, error: res.error };
      return { ok: true, sessionId: res.data.id, connectUrl: res.data.connectUrl };
    },
    connectSession: async (connectUrl) => {
      const handle = await connectToSession(connectUrl);
      return {
        executeAction: (action) => executeAction(handle.page, action),
        hitTest: (x, y) => hitTest(handle.page, x, y),
        focusedElement: () => focusedElement(handle.page),
        screenshot: () => takeScreenshot(handle.page),
        currentUrl: () => currentUrl(handle.page),
        close: () => handle.close(),
      };
    },
    releaseSession: async (sessionId) => {
      const res = await releaseBrowserbaseSession(sessionId);
      if (!res.ok) {
        console.warn("[browser-agent/worker-deps] session release failed", {
          sessionId,
          error: res.error,
        });
      }
    },
    storeScreenshot: async (params) => storeJobScreenshot(params),
    logStepCost: async (params) => {
      await logCostEvent({
        ownerId: params.ownerId,
        featureSlug: BROWSER_AGENT_COST_FEATURE_SLUG,
        backend: "anthropic",
        model: BROWSER_AGENT_MODEL,
        costMicroCents: params.costMicroCents,
        tokensInput: params.tokensInput,
        tokensOutput: params.tokensOutput,
        idempotencyKey: `browser:${params.jobId}:${params.stepNumber}`,
        metadata: { job_id: params.jobId, step: String(params.stepNumber) },
      });
    },
    now: () => Date.now(),
  };
}
