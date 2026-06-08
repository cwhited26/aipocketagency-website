// tier-caps.ts — agent-minute + sub-agent caps for the orchestrator (SPEC v5 §10,
// PA-ORCH-5, PA-ORCH-10). Pure decision functions are split from DB I/O so the cap math is
// unit-tested in isolation (lib/orchestrator/__tests__/tier-caps.test.ts).
//
// SCOPE NOTE (PA-ORCH-16): the unified SMB tier ladder + the subscription→tier read live in
// the pricing lane's lib/personas/tier-caps.ts (landed `a152c5b`). This file REUSES that
// module read-only — it imports the Tier type, the labels, and getCurrentTier; it never
// edits it. Agent-minute economics are an orchestrator concern, so they live here, keyed on
// the same Tier enum so the two ladders can never drift on tier names.

import { getCurrentTier, TIER_LABELS, type Tier } from "@/lib/personas/tier-caps";
import { fetchOrchestratorUsage, reserveAgentMinutes } from "./db";

export type { Tier };
export { getCurrentTier, TIER_LABELS };

// ── Agent-minute monthly caps (SPEC §10; the prompt's locked numbers) ────────────────────
// null = unlimited (Enterprise fair-use). 0 = Starter (chat + memory + drafting only; the
// orchestrator is the upsell from Starter).
export const AGENT_MINUTE_CAPS: Record<Tier, number | null> = {
  starter: 0,
  pro: 100,
  pro_plus: 250,
  studio: 1000,
  studio_plus: 3000,
  enterprise: null,
};

// Max sub-agents (leaf tasks) one dispatched goal may fan out to, per SPEC §10's
// "Sub-agents per task" column. null = unlimited.
export const MAX_SUBAGENTS_PER_TASK: Record<Tier, number | null> = {
  starter: 0,
  pro: 3,
  pro_plus: 5,
  studio: 10,
  studio_plus: 25,
  enterprise: null,
};

// Successful manual Approves of one (connector, action) before the auto-approve toggle
// unlocks (SPEC §9.4 "after 10 successful Approves … trust me to send … on my own?").
export const AUTO_APPROVE_TRUST_WINDOW = 10;

// Per-(connector, action) overrides that HARD-TIGHTEN the default trust window for actions that
// move real money (QuickBooks mini-spec, roadmap §2.3). An action absent from this map uses
// AUTO_APPROVE_TRUST_WINDOW. record_payment carries the highest bar in the whole connector set:
// even after clearing 20 approvals it stays opt-in / default-off (the owner must deliberately
// flip the toggle; the higher count only makes that option available).
export const CONNECTOR_ACTION_TRUST_OVERRIDES: Readonly<Record<string, number>> = {
  "quickbooks:create_invoice": 10,
  "quickbooks:record_payment": 20,
};

/** The trust window for a specific (connector, action), honoring the money-action overrides. */
export function connectorActionTrustWindow(connector: string, action: string): number {
  return (
    CONNECTOR_ACTION_TRUST_OVERRIDES[`${connector.trim().toLowerCase()}:${action.trim().toLowerCase()}`] ??
    AUTO_APPROVE_TRUST_WINDOW
  );
}

export type CapDecision = { ok: boolean; reason: string };

// ── Pure decision functions ──────────────────────────────────────────────────────────────

/** yyyy-mm key (UTC) for the usage-monthly partition. Matches lib/personas monthKey. */
export function monthKey(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function agentMinuteCap(tier: Tier): number | null {
  return AGENT_MINUTE_CAPS[tier];
}

export function maxSubAgents(tier: Tier): number | null {
  return MAX_SUBAGENTS_PER_TASK[tier];
}

/**
 * Pre-flight (non-atomic) check that a run of `requestedMinutes` could fit under the tier's
 * monthly cap given `usedMinutes` already metered. The authoritative enforcement is the
 * atomic reserve RPC (orchestrator_reserve_agent_minutes); this drives the upgrade CTA copy
 * and lets the dispatcher refuse the Starter tier (cap 0) without a round trip.
 */
export function evaluateAgentMinutes(
  tier: Tier,
  usedMinutes: number,
  requestedMinutes: number,
): CapDecision {
  const cap = AGENT_MINUTE_CAPS[tier];
  if (cap === null) return { ok: true, reason: "" };
  if (cap === 0) {
    return {
      ok: false,
      reason:
        "The orchestrator — sub-agents that actually do the work — is part of Pocket Agent Pro. " +
        "Upgrade to Pro to let Pocket Agent run tasks for you.",
    };
  }
  if (usedMinutes >= cap) {
    return {
      ok: false,
      reason:
        "You've used all of this month's agent-minutes on your plan. They reset next month — " +
        "or upgrade for more headroom.",
    };
  }
  if (usedMinutes + requestedMinutes > cap) {
    const remaining = Math.max(0, cap - usedMinutes);
    return {
      ok: false,
      reason:
        `This task needs about ${requestedMinutes} agent-minutes but only ${remaining} remain ` +
        "on your plan this month. Upgrade for more, or wait for next month's reset.",
    };
  }
  return { ok: true, reason: "" };
}

/** Pure: does this scaffold's leaf count fit the tier's sub-agents-per-task limit? */
export function evaluateSubAgentFanout(tier: Tier, leafCount: number): CapDecision {
  const max = MAX_SUBAGENTS_PER_TASK[tier];
  if (max === null) return { ok: true, reason: "" };
  if (max === 0) {
    return {
      ok: false,
      reason: "Running tasks with sub-agents requires Pocket Agent Pro.",
    };
  }
  if (leafCount > max) {
    return {
      ok: false,
      reason:
        `This plan fans out to ${leafCount} sub-agents but your plan runs up to ${max} per task. ` +
        "Upgrade for wider fan-out, or narrow the goal.",
    };
  }
  return { ok: true, reason: "" };
}

/** Pure: has this (connector, action) cleared the trust window so auto-approve can unlock? */
export function autoApproveUnlocked(successCount: number): boolean {
  return successCount >= AUTO_APPROVE_TRUST_WINDOW;
}

/**
 * Pure: has this SPECIFIC (connector, action) cleared its trust window? Honors the money-action
 * overrides (e.g. quickbooks:record_payment needs 20), falling back to the default window. Use
 * this anywhere a connector + action is known; autoApproveUnlocked() stays for the connector-
 * agnostic callers that only have a count.
 */
export function autoApproveUnlockedFor(
  connector: string,
  action: string,
  successCount: number,
): boolean {
  return successCount >= connectorActionTrustWindow(connector, action);
}

// ── DB-backed wrapper ────────────────────────────────────────────────────────────────────

/** The owner's current agent-minute cap (null = unlimited), via the shared tier read. */
export async function getAgentMinuteCap(businessId: string): Promise<number | null> {
  const tier = await getCurrentTier(businessId);
  return AGENT_MINUTE_CAPS[tier];
}

/**
 * Soft pre-check used to render the upgrade CTA before dispatch. Reads the live tier + the
 * month's usage and returns whether a run of `requestedMinutes` would fit. NOT authoritative
 * under concurrency — `reserveRun` (the atomic RPC) is the real gate.
 */
export async function canDispatchRun(
  businessId: string,
  requestedMinutes: number,
): Promise<CapDecision> {
  const tier = await getCurrentTier(businessId);
  const usage = await fetchOrchestratorUsage(businessId, monthKey());
  return evaluateAgentMinutes(tier, usage?.agent_minutes_used ?? 0, requestedMinutes);
}

export type ReserveResult =
  | { ok: true; reservedMinutes: number; cap: number | null }
  | { ok: false; reason: string };

/**
 * Atomically reserve `requestedMinutes` against the month's cap (race-free, via the
 * orchestrator_reserve_agent_minutes RPC). Returns ok:false with upgrade copy when the
 * reservation would exceed the cap. The reservation is reconciled to actuals when the run
 * finishes (db.reconcileAgentMinutes).
 */
export async function reserveRun(
  businessId: string,
  requestedMinutes: number,
): Promise<ReserveResult> {
  const tier = await getCurrentTier(businessId);
  const cap = AGENT_MINUTE_CAPS[tier];

  // Starter (cap 0) never reserves — short-circuit with the upsell copy.
  if (cap === 0) {
    return { ok: false, reason: evaluateAgentMinutes(tier, 0, requestedMinutes).reason };
  }

  const reserved = await reserveAgentMinutes({
    businessId,
    month: monthKey(),
    minutes: requestedMinutes,
    cap,
  });
  if (!reserved) {
    return {
      ok: false,
      reason:
        "This would put you over your monthly agent-minute budget. It resets next month — " +
        "or upgrade for more runtime.",
    };
  }
  return { ok: true, reservedMinutes: requestedMinutes, cap };
}
