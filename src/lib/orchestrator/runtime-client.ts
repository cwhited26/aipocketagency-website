// runtime-client.ts — thin client that dispatches sub-agent jobs to the Modal runtime
// (PA-ORCH-3: Modal) over HTTP and lets the runtime report back via the webhook receiver at
// /api/orchestrator/webhook.
//
// PA web (Node) never runs sub-agents in-process — Vercel functions max out too low for the
// 7-phase Algorithm. It POSTs a job to the deployed Modal web endpoint and returns; the Modal
// app drives the phases and calls our webhook with progress + completion.
//
// Graceful degradation: when the runtime isn't configured yet (no PA_ORCHESTRATOR_RUNTIME_URL
// / Modal tokens), dispatch() returns { ok: false, degraded: "not_configured" } and the
// dispatcher persists the run in 'planning' WITHOUT firing anything. Prod stays safe until
// Chase deploys Modal and sets the envs — nothing half-fires.

import type { SubAgentSpec } from "./types";

export type RuntimeConfig = {
  url: string;
  tokenId: string;
  tokenSecret: string;
  webhookUrl: string;
  webhookSecret: string;
};

/** Reads the Modal runtime config from env, or null when any required value is missing. */
export function runtimeConfig(): RuntimeConfig | null {
  const url = process.env.PA_ORCHESTRATOR_RUNTIME_URL;
  const tokenId = process.env.MODAL_TOKEN_ID;
  const tokenSecret = process.env.MODAL_TOKEN_SECRET;
  const webhookSecret = process.env.PA_ORCHESTRATOR_RUNTIME_TOKEN;
  if (!url || !tokenId || !tokenSecret || !webhookSecret) return null;

  // Where the runtime calls back. PA_PUBLIC_URL (or VERCEL_URL) + the webhook path.
  const base =
    process.env.PA_PUBLIC_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
    "https://aipocketagent.com";
  return {
    url: url.replace(/\/$/, ""),
    tokenId,
    tokenSecret,
    webhookSecret,
    webhookUrl: `${base.replace(/\/$/, "")}/api/orchestrator/webhook`,
  };
}

export function isRuntimeConfigured(): boolean {
  return runtimeConfig() !== null;
}

export type DispatchJob = {
  runId: string;
  businessId: string;
  spec: SubAgentSpec;
  timeBudgetSeconds: number;
  // The owner's brain repo so the runtime can read zone-scoped context via the PA REST API.
  brainRepo: string | null;
};

export type DispatchResult =
  | { ok: true; runtimeJobId: string | null }
  | { ok: false; degraded: "not_configured" }
  | { ok: false; degraded: "error"; error: string };

/**
 * POSTs a sub-agent job to the Modal runtime. The runtime authenticates the call with the
 * Modal token headers; the body carries the run, its spec, and the webhook coordinates the
 * runtime uses to report progress back. Returns the runtime's job id when it echoes one.
 */
export async function dispatch(job: DispatchJob): Promise<DispatchResult> {
  const cfg = runtimeConfig();
  if (!cfg) return { ok: false, degraded: "not_configured" };

  try {
    const res = await fetch(cfg.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Modal-Key": cfg.tokenId,
        "Modal-Secret": cfg.tokenSecret,
      },
      body: JSON.stringify({
        runId: job.runId,
        businessId: job.businessId,
        spec: job.spec,
        timeBudgetSeconds: job.timeBudgetSeconds,
        brainRepo: job.brainRepo,
        callback: { url: cfg.webhookUrl, secret: cfg.webhookSecret },
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, degraded: "error", error: `Runtime ${res.status}: ${text.slice(0, 200)}` };
    }
    const data = (await res.json().catch(() => ({}))) as { jobId?: string };
    return { ok: true, runtimeJobId: typeof data.jobId === "string" ? data.jobId : null };
  } catch (e) {
    return {
      ok: false,
      degraded: "error",
      error: e instanceof Error ? e.message : "Runtime dispatch failed",
    };
  }
}

/** Best-effort cancel signal to the runtime (the run row is the source of truth either way). */
export async function requestCancel(runId: string): Promise<boolean> {
  const cfg = runtimeConfig();
  if (!cfg) return false;
  try {
    const res = await fetch(`${cfg.url}/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Modal-Key": cfg.tokenId,
        "Modal-Secret": cfg.tokenSecret,
      },
      body: JSON.stringify({ runId }),
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Best-effort signal to the runtime that a staged action was decided, so a blocked tool call
 * can resume (with the possibly-edited payload) or abort. No-op when the runtime isn't
 * configured — the approval row is the source of truth and a polling runtime will see it.
 */
export async function notifyApproval(input: {
  runId: string;
  approvalId: string;
  decision: "approved" | "rejected";
  payload?: Record<string, unknown> | null;
}): Promise<boolean> {
  const cfg = runtimeConfig();
  if (!cfg) return false;
  try {
    const res = await fetch(`${cfg.url}/approval`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Modal-Key": cfg.tokenId,
        "Modal-Secret": cfg.tokenSecret,
      },
      body: JSON.stringify({
        runId: input.runId,
        approvalId: input.approvalId,
        decision: input.decision,
        payload: input.payload ?? null,
      }),
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Constant-time-ish comparison of the webhook shared secret. */
export function verifyWebhookSecret(provided: string | null): boolean {
  const expected = process.env.PA_ORCHESTRATOR_RUNTIME_TOKEN;
  if (!expected || !provided) return false;
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  return diff === 0;
}
