// cost.ts — the Browser Agent's cost model + hard cap, pure and unit-tested. Units follow the
// pa_cost_events ledger (migration 056): micro-cents, 1 USD = 1,000,000 micro-cents.
//
// A step costs (a) the Computer Use tokens for that planning call and (b) the Browserbase
// seconds the browser ran since the last step. The per-job hard cap halts a runaway job
// before it can spend past max_cost_micro_cents — the check runs BEFORE each planning call.

// claude-sonnet-4-6: $3 / MTok input → 3 micro-cents per token; $15 / MTok output → 15.
export const SONNET_INPUT_MICRO_CENTS_PER_TOKEN = 3;
export const SONNET_OUTPUT_MICRO_CENTS_PER_TOKEN = 15;

// Browserbase browser-hours: modeled at $0.20/hr (flagged ESTIMATED — reconcile against the
// real plan's rate once the account is provisioned). 20¢/hr = 200,000 micro-cents / 3600s.
export const BROWSERBASE_MICRO_CENTS_PER_SECOND = 56;

export type StepCostInput = {
  tokensInput: number;
  tokensOutput: number;
  browserSeconds: number;
};

/** Micro-cents one step adds to the job's running estimate. */
export function stepCostMicroCents(input: StepCostInput): number {
  const tokens =
    Math.max(0, input.tokensInput) * SONNET_INPUT_MICRO_CENTS_PER_TOKEN +
    Math.max(0, input.tokensOutput) * SONNET_OUTPUT_MICRO_CENTS_PER_TOKEN;
  const browser = Math.max(0, input.browserSeconds) * BROWSERBASE_MICRO_CENTS_PER_SECOND;
  return Math.ceil(tokens + browser);
}

export type CostCapDecision = { ok: true } | { ok: false; reason: string };

/**
 * The hard cap. Called before every planning call with the job's accrued estimate; a job at
 * or past its cap halts as failed with this reason (never a silent stop).
 */
export function evaluateCostCap(params: {
  spentMicroCents: number;
  maxCostMicroCents: number;
}): CostCapDecision {
  if (params.spentMicroCents < params.maxCostMicroCents) return { ok: true };
  return {
    ok: false,
    reason: `Cost cap reached: ${formatMicroCentsUsd(params.spentMicroCents)} spent of the ${formatMicroCentsUsd(params.maxCostMicroCents)} limit for this job.`,
  };
}

/** "$1.23" for the UI + halt messages. */
export function formatMicroCentsUsd(microCents: number): string {
  return `$${(Math.max(0, microCents) / 1_000_000).toFixed(2)}`;
}
