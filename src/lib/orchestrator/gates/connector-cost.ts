// connector-cost.ts — the Connector Cost Gate (PA-GATE-2, SPEC §10 gate 7).
//
// When the plan calls connectors with per-action cost (Twilio SMS, Whisper minutes, Stripe writes,
// Calendly links), estimates the total spend and flags if it exceeds the per-Project budget the
// owner set (default $10, PA_GATE_CONNECTOR_BUDGET_USD). Catches the plan that wants to text 4,000
// storm leads before the owner sees the bill. Deterministic — a cost estimate should be arithmetic
// the owner can audit, not a model guess.

import type { GateVerdict, Severity } from "./schema";
import type { GateContext, GateRun } from "./types";
import { flattenTasks, type TaskRef } from "./plan-render";

// Conservative per-action cost in USD for the metered connectors. These are deliberately upper-bound
// estimates (the gate's job is to catch the runaway, not to bill); the owner sees the math on the
// card. Keys are matched against a task's executor (lowercased, normalized).
const PER_ACTION_USD: Readonly<Record<string, number>> = {
  twilio: 0.01, // one SMS (message + carrier fees)
  sms: 0.01,
  twilio_sms: 0.01,
  whisper: 0.006, // one minute of transcription
  stripe: 0.3, // one payment-link / invoice (proxy for the fixed processing fee)
  stripe_connect: 0.3,
  calendly: 0.0, // mint a booking link — no per-action charge, listed for completeness
};

function meteredCost(executor: string): number | null {
  const key = executor.trim().toLowerCase().replace(/\s+/g, "_");
  return key in PER_ACTION_USD ? PER_ACTION_USD[key] : null;
}

/**
 * The volume a metered task implies: the largest plain integer in its text (commas stripped),
 * defaulting to 1 when the plan names no count. "text 4,000 storm leads" → 4000.
 */
export function estimateVolume(task: TaskRef): number {
  const nums = task.text.replace(/(\d),(?=\d{3}\b)/g, "$1").match(/\b\d{2,}\b/g);
  if (!nums) return 1;
  const max = Math.max(...nums.map((n) => Number(n)));
  return Number.isFinite(max) && max > 1 ? max : 1;
}

export const runConnectorCostGate: GateRun = async (ctx: GateContext): Promise<GateVerdict> => {
  const lines: { ref: string; executor: string; volume: number; cost: number }[] = [];
  let total = 0;
  for (const task of flattenTasks(ctx.scaffold)) {
    const unit = meteredCost(task.executor);
    if (unit == null || unit === 0) continue;
    const volume = estimateVolume(task);
    const cost = unit * volume;
    total += cost;
    lines.push({ ref: task.ref, executor: task.executor.trim(), volume, cost });
  }

  const budget = ctx.connectorBudgetUsd;
  if (total <= budget) {
    return { status: "pass", finding: null };
  }

  // Over budget → flag. Severity scales with how far over.
  const ratio = total / Math.max(budget, 0.01);
  const severity: Severity = ratio >= 5 ? "critical" : ratio >= 2 ? "high" : "medium";
  const worst = lines.reduce((a, b) => (b.cost > a.cost ? b : a), lines[0]);
  const breakdown = lines
    .map((l) => `${l.ref} (${l.executor}): ${l.volume} × $${l.cost.toFixed(2)}`)
    .join("; ");

  return {
    status: "flag",
    finding: {
      rule_violated: `Estimated metered-connector spend ($${total.toFixed(2)}) exceeds the per-Project budget ($${budget.toFixed(2)}).`,
      rule_source: "Per-action connector cost table + your per-Project budget (Trust Ladder)",
      plan_task_violating: `${worst.ref} — ${worst.executor}`,
      severity,
      suggested_fix:
        `Lower the volume, split the send into batches, or raise this Project's connector budget in ` +
        `Settings → Trust Ladder if $${total.toFixed(2)} is intended.`,
      evidence: `Estimated spend $${total.toFixed(2)} vs budget $${budget.toFixed(2)}. Breakdown: ${breakdown}`,
    },
  };
};
