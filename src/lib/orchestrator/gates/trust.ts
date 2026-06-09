// trust.ts — the per-gate Approve-anyway trust ladder (PA-GATE-5 + SPEC §12 trust-window-gaming).
//
// Mirrors the action-approval trust window (APA-ORCH-25, tier-caps.ts): a gate's flags can be
// waved through with "Approve anyway" only after that gate has cleared a streak of consecutive
// clean passes. The streak resets to 0 on any flag (pa_gate_overrides.clean_pass_count, atomic via
// the gate_record_result RPC), so a single real flag re-locks the override. Security is the
// highest-stakes override and gets the longest window — and its hard_fails can NEVER be
// approved-anyway regardless of window (SPEC §10 gate 5).

import type { GateName, GateStatus } from "./schema";

/** Default consecutive-clean-pass window before per-gate Approve-anyway unlocks (PA-GATE-5). */
export const DEFAULT_GATE_TRUST_WINDOW = 10;

// Per-gate overrides that HARD-TIGHTEN the default window. Security is a far higher bar because a
// security override is the highest-stakes override (SPEC §10 gate 5). Absent a gate uses the default.
export const GATE_TRUST_WINDOW_OVERRIDES: Readonly<Record<GateName, number>> = {
  voice: DEFAULT_GATE_TRUST_WINDOW,
  customer_name: DEFAULT_GATE_TRUST_WINDOW,
  decision: DEFAULT_GATE_TRUST_WINDOW,
  code_convention: DEFAULT_GATE_TRUST_WINDOW,
  security: 25,
  test: DEFAULT_GATE_TRUST_WINDOW,
  connector_cost: DEFAULT_GATE_TRUST_WINDOW,
};

/** The consecutive-clean-pass window this gate must clear before Approve-anyway can be offered. */
export function gateTrustWindow(gate: GateName): number {
  return GATE_TRUST_WINDOW_OVERRIDES[gate] ?? DEFAULT_GATE_TRUST_WINDOW;
}

/** True iff this gate has cleared its window — i.e. the owner MAY enable per-gate auto-dismiss. */
export function autoDismissUnlocked(gate: GateName, cleanPassCount: number): boolean {
  return cleanPassCount >= gateTrustWindow(gate);
}

/**
 * Whether the owner can "Approve anyway" THIS finding right now. A flag is overridable once the
 * gate's window is cleared AND the owner has turned its auto-dismiss on. A 'hard_fail' is
 * overridable the same way EXCEPT for the Security Gate, whose hard-fails are never overridable
 * (SPEC §10 gate 5). An 'error' (a broken safety check) is never overridable — the only honest
 * paths past a gate that couldn't run are Revise or Reject (fail closed, Principle 6).
 */
export function isFindingOverridable(input: {
  gate: GateName;
  status: GateStatus;
  cleanPassCount: number;
  autoDismissEnabled: boolean;
}): boolean {
  const { gate, status, cleanPassCount, autoDismissEnabled } = input;
  if (status === "pass" || status === "error") return false;
  if (status === "hard_fail" && gate === "security") return false;
  if (!autoDismissEnabled) return false;
  return autoDismissUnlocked(gate, cleanPassCount);
}
