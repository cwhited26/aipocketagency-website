// registry.ts — the v1.1 gate library (PA-GATE-2): the seven gates, the brain rule-files each
// declares it reads (its ContainmentGuard scope — a gate cannot read outside this list, SPEC §7),
// whether it's on by default, and whether it applies to every plan or only code plans (SPEC §10).
//
// Adding an owner-authored gate is v1.2; at v1.1 this set is fixed. The runner reads only the
// rule-files a gate declares here and hands them to that gate — nothing else.

import type { GateName } from "./schema";
import type { GateDefinition } from "./types";
import { runVoiceGate } from "./voice";
import { runCustomerNameGate } from "./customer-name";
import { runDecisionGate } from "./decision";
import { runCodeConventionGate } from "./code-convention";
import { runSecurityGate } from "./security";
import { runTestGate } from "./test";
import { runConnectorCostGate } from "./connector-cost";

export const GATE_REGISTRY: Readonly<Record<GateName, GateDefinition>> = {
  voice: {
    name: "voice",
    label: "Voice",
    description: "Audits external-facing copy against your voice spec + anti-slop checklist.",
    ruleFiles: [
      { path: "voice/chase-spec.md", required: true },
      { path: "memory/feedback_no_ai_slop_in_marketing_copy.md", required: false },
    ],
    enabledByDefault: true,
    appliesTo: "always",
    run: runVoiceGate,
  },
  customer_name: {
    name: "customer_name",
    label: "Customer Name",
    description: "Scans public-facing copy for real customer names from your protected-names list.",
    ruleFiles: [{ path: "memory/customer_names_protected.md", required: true }],
    enabledByDefault: true,
    appliesTo: "always",
    run: runCustomerNameGate,
  },
  decision: {
    name: "decision",
    label: "Decision Consistency",
    description: "Flags plans that contradict a locked decision in your Decision Logs.",
    ruleFiles: [
      { path: "APA/Decision_Log.md", required: true },
      { path: "AOS/AOS_Decision_Log.md", required: false },
      { path: "shared/Decision_Log.md", required: false },
    ],
    enabledByDefault: true,
    appliesTo: "always",
    run: runDecisionGate,
  },
  code_convention: {
    name: "code_convention",
    label: "Code Convention",
    description: "Audits the code approach against your CLAUDE.md §5 standing rules.",
    ruleFiles: [{ path: "CLAUDE.md", required: true }],
    enabledByDefault: true,
    appliesTo: "code",
    run: runCodeConventionGate,
  },
  security: {
    name: "security",
    label: "Security",
    description: "Flags secret exposure, missing RLS, auth bypass, and action-vs-intent mismatches.",
    ruleFiles: [
      { path: "CLAUDE.md", required: true },
      { path: "memory/feedback_secrets_via_1password.md", required: false },
    ],
    enabledByDefault: true,
    appliesTo: "always",
    run: runSecurityGate,
  },
  test: {
    name: "test",
    label: "Test",
    description: "Flags code shipped into a tested area without paired tests (coverage discipline).",
    ruleFiles: [{ path: "CLAUDE.md", required: true }],
    enabledByDefault: true,
    appliesTo: "code",
    run: runTestGate,
  },
  connector_cost: {
    name: "connector_cost",
    label: "Connector Cost",
    description: "Estimates metered-connector spend and flags plans over your per-Project budget.",
    ruleFiles: [],
    enabledByDefault: true,
    appliesTo: "always",
    run: runConnectorCostGate,
  },
};

export const ALL_GATES: readonly GateDefinition[] = Object.values(GATE_REGISTRY);

/** All distinct rule-file paths across the library — the union the runner may read. */
export function allDeclaredRuleFilePaths(): string[] {
  const set = new Set<string>();
  for (const def of ALL_GATES) for (const rf of def.ruleFiles) set.add(rf.path);
  return [...set];
}
