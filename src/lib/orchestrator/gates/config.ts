// config.ts — the Gate Phase env flags + tunables (SPEC §1, §6.4, §10 gate 7).
//
// The master flag defaults OFF: the Gate Phase is dark until Chase turns it on, AND only after
// Wave B's first real Project dispatch has landed (PA-GATE-1, bridge-before-the-boat). Off → the
// dispatcher fires leaf tasks exactly as before; the gate code never runs.

/** True only when the operator has explicitly enabled the Gate Phase. */
export function projectGatesEnabled(): boolean {
  return process.env.PA_PROJECT_GATES_ENABLED === "true";
}

/**
 * Per-gate wall-clock budget in ms (PA-GATE-8, default 60s). A gate that blows this returns
 * 'error' → fails closed. A slow gate is a broken gate — it blocks the owner's whole Project.
 */
export function gateTimeBudgetMs(): number {
  const raw = Number(process.env.PA_GATE_TIME_BUDGET_SEC);
  const seconds = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 60;
  return seconds * 1_000;
}

/**
 * The default per-Project metered-connector budget in USD (Connector Cost Gate, SPEC §10 gate 7).
 * The owner can raise/lower it per Project in the Trust Ladder; this is the platform default.
 */
export function gateConnectorBudgetUsd(): number {
  const raw = Number(process.env.PA_GATE_CONNECTOR_BUDGET_USD);
  return Number.isFinite(raw) && raw > 0 ? raw : 10;
}
