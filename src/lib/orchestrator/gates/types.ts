// types.ts — the shared vocabulary of the Gate Phase (SPEC §7, §10).
//
// A gate is a narrow-scope auditor: it reads a declared slice of the brain's rule-files plus the
// approved plan, and returns one structured verdict (schema.ts). Every external effect — reading
// rule-files, calling the LLM, writing the finding row — is injected, so each gate and the runner
// are unit-tested with mocks (no GitHub, no LLM, no DB). Zero `any`.

import type { Scaffold } from "../types";
import type { GateName, GateVerdict } from "./schema";

// The minimal LLM interface a judgment-gate depends on — same shape as the planner's PlannerLlm so
// the dispatcher's existing LLM wiring is reused. Deterministic gates (customer_name, connector_cost)
// ignore it.
export type GateLlm = (args: {
  system: string;
  user: string;
}) => Promise<{ ok: true; text: string } | { ok: false; error: string }>;

// A rule-file a gate declares it reads. `required` files gate fail-closed: if every required file
// is unreadable, the gate returns 'error' (PA-GATE-4). Optional files (e.g. voice/examples/*) that
// are missing are simply skipped — a fresh brain without them still runs the gate against its
// primary rule-file rather than hard-erroring on a supplementary one.
export type RuleFileSpec = {
  path: string;
  required: boolean;
};

// The rule-files the runner read for a gate, path → content (null = unreadable/missing).
export type RuleFileSet = ReadonlyMap<string, string | null>;

// What a gate sees: the plan, the rule-files it declared, and whether the plan involves code.
export type GateContext = {
  businessId: string;
  goal: string;
  scaffold: Scaffold;
  // Only the rule-files THIS gate declared (ContainmentGuard — a gate cannot read outside its
  // scope, SPEC §7). Keyed by the declared path.
  ruleFiles: RuleFileSet;
  // True when the plan builds/edits code (CRM / website / automation / dashboard) — gates the
  // code-only gates (code_convention, test) per SPEC §10.
  involvesCode: boolean;
  // The owner's per-Project metered-connector budget in USD (Connector Cost Gate, PA-GATE default
  // $10). Carried here so the runner stays the only place env is read.
  connectorBudgetUsd: number;
};

// A gate's run function. Returns the RAW verdict (status + finding); the runner stamps timing,
// validates the shape, and converts malformed/timeout into a fail-closed 'error'.
export type GateRun = (ctx: GateContext, llm: GateLlm) => Promise<GateVerdict>;

export type GateDefinition = {
  name: GateName;
  // Human label for the card / settings ("Customer Name").
  label: string;
  // One-line description of what the gate checks (Trust Ladder + per-gate detail).
  description: string;
  ruleFiles: RuleFileSpec[];
  // false → the gate is skipped unless the owner enables it. All seven default true at v1.1
  // (always-on phase, PA-GATE-1); enabled here is the library default, the owner override lives
  // in pa_gate_overrides.
  enabledByDefault: boolean;
  // 'always' runs on every plan; 'code' runs only when the plan involves code (SPEC §10 gates 4, 6).
  appliesTo: "always" | "code";
  run: GateRun;
};
