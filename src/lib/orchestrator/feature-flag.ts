// feature-flag.ts — the dispatcher-facing gates + tunables for the PA v5 Wave B orchestrator.
//
// The master flag defaults OFF so the orchestrator is dark until Chase turns it on (PA-ORCH-12
// "don't burn the bridge before the boat is built"). Off → chat send falls back to Wave A
// behaviour. The Modal runtime config (URL + tokens) is owned by runtime-client.ts
// (runtimeConfig()); when that's unconfigured the dispatcher persists runs plan-only so the
// surface is still demoable without Modal wired.

/** True only when the operator has explicitly enabled the orchestrator. */
export function orchestratorEnabled(): boolean {
  return process.env.PA_ORCHESTRATOR_ENABLED === "true";
}

/** Default per-sub-agent wall-clock budget (seconds). SPEC §11.4 default 300. */
export function defaultTimeBudgetSeconds(): number {
  const raw = Number(process.env.PA_ORCHESTRATOR_DEFAULT_TIME_BUDGET_SEC);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 300;
}

/** Max concurrent non-terminal runs one owner may hold. SPEC §11.4 default 5. */
export function maxConcurrentRunsPerUser(): number {
  const raw = Number(process.env.PA_ORCHESTRATOR_MAX_CONCURRENT_RUNS_PER_USER);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 5;
}
