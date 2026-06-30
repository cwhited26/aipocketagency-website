// trust-ladder.ts — pure per-domain gating decision (SPEC §"Security gates" 4 + the prompt's Trust
// Ladder). Every browser_* tool call that clears the refuse list + the tier cap resolves to one of:
//   • "auto"   — run now, no card (the domain is allow + auto_approve, which the owner could only
//                turn on after the ladder unlocked).
//   • "manual" — stage a browser_action_approval card; the owner taps Approve.
//   • "deny"   — the owner explicitly denied this domain; block it (audit 'blocked', no run).
//
// The ladder UNLOCK is the separate gate the permissions UI reads: a domain can only have
// auto_approve flipped on once the owner has manually approved ≥ TRUST_LADDER_THRESHOLD executed
// actions for it. canUnlockAutoApprove() is that pure check; the route enforces it on write so a
// crafted request can't enable auto-approve early.
//
// Split from all DB I/O so the decision table is exhaustively unit-tested.

export const TRUST_LADDER_THRESHOLD = 5;

/** The owner's standing per-domain permission, as stored in pa_browser_domain_permissions. */
export type DomainPermission = {
  decision: "allow" | "deny";
  autoApprove: boolean;
};

export type DomainDecision = "auto" | "manual" | "deny";

/**
 * Resolve the gate for one domain given the owner's stored permission (null = no row yet) and how
 * many actions they've manually approved for it. Pure.
 *
 * Defaults when there's no row: allowed, but always card-gated (decision 'manual'). auto_approve is
 * honored only when the ladder has actually unlocked — a stale auto_approve=true with an
 * approval count that has somehow dropped below the threshold falls back to 'manual' (belt-and-
 * suspenders, symmetric with the connector-action never-auto-approve guard).
 */
export function resolveDomainDecision(
  permission: DomainPermission | null,
  manualApprovalCount: number,
): DomainDecision {
  if (!permission) return "manual";
  if (permission.decision === "deny") return "deny";
  if (permission.autoApprove && canUnlockAutoApprove(manualApprovalCount)) return "auto";
  return "manual";
}

/** Pure: has this domain cleared the Trust Ladder so auto-approve may be enabled? */
export function canUnlockAutoApprove(manualApprovalCount: number): boolean {
  return manualApprovalCount >= TRUST_LADDER_THRESHOLD;
}

/** How many more manual approvals until the ladder unlocks (0 once unlocked). For the UI copy. */
export function approvalsUntilUnlock(manualApprovalCount: number): number {
  return Math.max(0, TRUST_LADDER_THRESHOLD - manualApprovalCount);
}
