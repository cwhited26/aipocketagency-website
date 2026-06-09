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
// move real money (QuickBooks mini-spec, roadmap §2.3; Stripe mini-spec, roadmap §2.4). An action
// absent from this map uses AUTO_APPROVE_TRUST_WINDOW. record_payment carries a high bar (20).
//
// stripe:refund_charge is the ONLY entry set to Infinity — an UNREACHABLE window. A refund moves
// real money OUT and is the prime prompt-injection target (roadmap §2.4, abuse-risk 5), so it can
// NEVER become auto-approve eligible regardless of how many were manually approved: every refund
// is an explicit per-action owner tap, forever. autoApproveUnlockedFor() reads this, so the
// auto-approve toggle route refuses to enable it and the approval route never reports it unlocked.
//
// Zoom (Zoom Connection lane, task item 8): create_meeting clears at the default window (10) —
// generating a join link has no real-world side effect until someone joins. update_meeting and
// cancel_meeting carry a higher bar (20) because they alter / remove a meeting already on the
// books and notify attendees.
//
// Modal Sandbox (Build Tools Roadmap §7.4, PA-BUILD-12): spawn_container and an ORDINARY
// run_command (pnpm install / build / test, npm run lint) clear at the default window (10, listed
// for intent). The dangerous-command bar — run_command with a shell-special char or a
// network/destructive tool is single-approval FOREVER — CANNOT be expressed in this (connector,
// action) map because it depends on the command PAYLOAD, not the action name. That guardrail lives
// in lib/connectors/modal-sandbox (isModalSandboxNeverAutoApprove + the per-command gate), which
// the staging + auto-approve-toggle layers consult; this map only sets the ordinary-command floor.
export const CONNECTOR_ACTION_TRUST_OVERRIDES: Readonly<Record<string, number>> = {
  "quickbooks:create_invoice": 10,
  "quickbooks:record_payment": 20,
  "stripe:refund_charge": Number.POSITIVE_INFINITY,
  "zoom:update_meeting": 20,
  "zoom:cancel_meeting": 20,
  // Calendly (roadmap §9): create_one_off_link is low-risk — it only mints a link; nothing happens
  // out there until a prospect books — so it carries the default window (10, listed here for
  // intent). cancel_scheduled_event notifies a prospect who already booked, so it stays gated far
  // longer (25) before auto-approve can even be offered.
  "calendly:create_one_off_link": 10,
  "calendly:cancel_scheduled_event": 25,
  "modal_sandbox:spawn_container": 10,
  "modal_sandbox:run_command": 10,
  // GitHub Build (Build Tools SPEC §11): push_files is Infinity — an UNREACHABLE window, like
  // stripe:refund_charge. Writing code to a repo is the prime prompt-injection target (a sub-agent
  // could draft exfiltrating code), so NO number of prior approvals ever unlocks auto-approve.
  // Every push surfaces its diff for one human tap, forever. create_repo / create_branch /
  // open_pull_request clear at the default window (10).
  "github_build:push_files": Number.POSITIVE_INFINITY,
  // Vercel (Build Tools Roadmap §7.2, §11): create_project / set_env_var / trigger_deploy clear at
  // the default window (10) — reversible (delete the project, change the var, redeploy).
  // attach_domain is Infinity — an UNREACHABLE window, like github_build:push_files — because
  // pointing a custom domain moves real DNS-routed traffic: it is single-approval FOREVER and can
  // never become auto-approve eligible. Every attach is an explicit owner tap.
  "vercel:attach_domain": Number.POSITIVE_INFINITY,
  // Supabase (Build Tools SPEC §7.3): apply_migration is Infinity — an UNREACHABLE window, like
  // github_build:push_files. A migration is an irreversible change to the owner's live data layer,
  // so NO number of prior approvals ever unlocks auto-approve — every migration is one human tap on
  // the full SQL, forever. create_project / seed_data clear at the default window (10).
  "supabase:apply_migration": Number.POSITIVE_INFINITY,
};

/** The trust window for a specific (connector, action), honoring the money/build overrides. */
export function connectorActionTrustWindow(connector: string, action: string): number {
  return (
    CONNECTOR_ACTION_TRUST_OVERRIDES[`${connector.trim().toLowerCase()}:${action.trim().toLowerCase()}`] ??
    AUTO_APPROVE_TRUST_WINDOW
  );
}

/**
 * True iff this (connector, action) can NEVER become auto-approve eligible regardless of approval
 * count — its trust window is infinite (stripe:refund_charge, github_build:push_files). The staging
 * middleware uses this as a belt-and-suspenders so even a stale "enabled" settings row can't
 * auto-fire such an action.
 */
export function isConnectorActionNeverAutoApprove(connector: string, action: string): boolean {
  return !Number.isFinite(connectorActionTrustWindow(connector, action));
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
