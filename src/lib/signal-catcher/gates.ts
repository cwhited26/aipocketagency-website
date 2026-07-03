// gates.ts — the Gate Phase treatment for Signal Catcher proposals (PA-SIGNAL-1). Same two-layer
// shape as the Agent Builder's gates (lib/agent-builder/gates.ts):
//
//   1. ALWAYS: the deterministic Customer Name scan over the proposed ritual name. A protected
//      name in a ritual name would ride into every staged result card and email digest that
//      ritual ever produces — so the gate REWRITES it ("Patrick Follow-Up Check" → "a customer
//      Follow-Up Check" reads wrong, so the whole name segment swaps to the anonymized pattern).
//      The owner's verbatim quote is NOT rewritten — the card is an owner-only surface showing
//      the owner their own words.
//
//   2. WHEN PA_PROJECT_GATES_ENABLED: the full gate library (voice / customer name / decision —
//      the code gates skip, a ritual proposal isn't a code plan) over a one-task scaffold built
//      from the proposal. A non-clean verdict drops the proposal (fail closed, PA-GATE-4) — a
//      card the gates couldn't clear never renders.

import { fetchPaUser } from "@/lib/pa-supabase";
import { fetchFileContent } from "@/lib/pa-brain";
import { completeLlm } from "@/lib/llm/dispatch";
import { ScaffoldSchema, type Scaffold } from "@/lib/orchestrator/types";
import { executeGatePhase, type GateOverrideSnapshot } from "@/lib/orchestrator/gates/runner";
import type { GateLlm } from "@/lib/orchestrator/gates/types";
import type { GateName } from "@/lib/orchestrator/gates/schema";
import { listGateOverrides } from "@/lib/orchestrator/gates/db";
import {
  gateConnectorBudgetUsd,
  gateTimeBudgetMs,
  projectGatesEnabled,
} from "@/lib/orchestrator/gates/config";
import { parseProtectedNames } from "@/lib/orchestrator/gates/customer-name";
import { signalCatcherLog } from "./log";

const PROTECTED_FILE = "memory/customer_names_protected.md";

export type SignalGateOutcome =
  | { ok: true; ritualName: string; nameRewritten: boolean }
  | { ok: false; reason: string };

function escapeForRegex(name: string): string {
  return name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Layer 1: swap any protected customer name out of the ritual name. Pure — unit-testable. */
export function rewriteProtectedNames(
  ritualName: string,
  protectedNames: readonly string[],
): { name: string; rewritten: boolean } {
  let name = ritualName;
  let rewritten = false;
  for (const protectedName of protectedNames) {
    const re = new RegExp(`\\b${escapeForRegex(protectedName)}(?:'s)?\\b`, "gi");
    if (re.test(name)) {
      name = name.replace(re, "Customer");
      rewritten = true;
    }
  }
  // Collapse doubled spaces a swap can leave behind.
  return { name: name.replace(/\s{2,}/g, " ").trim(), rewritten };
}

/** The one-task scaffold the gate library audits — frames the proposal's card copy as the
 *  external-facing output without tripping the code-plan markers. */
export function scaffoldForSignalProposal(params: {
  quote: string;
  ritualName: string;
  cadenceSummary: string;
}): Scaffold {
  return ScaffoldSchema.parse({
    project: `Propose a recurring ritual: ${params.ritualName}`.slice(0, 490),
    definitionOfDone: "The owner approved, edited, or rejected the proposed ritual.",
    successCriteria: [],
    milestones: [
      {
        title: "Ritual proposal",
        definitionOfDone: "",
        tasks: [
          {
            title: `Stage the "${params.ritualName}" ritual proposal card`.slice(0, 490),
            inputs: `The owner's own words: ${params.quote.slice(0, 600)}`,
            expectedOutput: `A Mission Control card proposing the "${params.ritualName}" ritual, running ${params.cadenceSummary} — copy shown to the owner.`,
            executor: "signal_catcher",
          },
        ],
      },
    ],
  });
}

/**
 * Run the gate treatment for one proposal, before its card is staged. Layer 1 (the protected-name
 * rewrite) always runs; layer 2 (the full Gate Phase) rides the same platform flag as the
 * dispatcher and the Agent Builder.
 */
export async function runSignalProposalGates(params: {
  ownerId: string;
  quote: string;
  ritualName: string;
  cadenceSummary: string;
}): Promise<SignalGateOutcome> {
  const paRes = await fetchPaUser(params.ownerId);
  const repo = paRes.ok && paRes.data ? paRes.data.brain_repo : null;
  const token = paRes.ok && paRes.data ? paRes.data.github_token : null;
  const anthropicKey = paRes.ok && paRes.data ? (paRes.data.anthropic_api_key ?? "") : "";

  // Layer 1 — always on. No brain / no protected list means nothing to protect yet.
  let ritualName = params.ritualName;
  let nameRewritten = false;
  if (repo) {
    const content = await fetchFileContent(repo, PROTECTED_FILE, token).catch(() => null);
    const parsed = content && content.trim() ? parseProtectedNames(content) : null;
    if (parsed && parsed.names.length > 0) {
      const result = rewriteProtectedNames(ritualName, parsed.names);
      ritualName = result.name;
      nameRewritten = result.rewritten;
      if (nameRewritten) {
        signalCatcherLog.info("protected name rewritten out of ritual name", {
          ownerId: params.ownerId,
        });
      }
    }
  }
  if (!ritualName) {
    return { ok: false, reason: "The ritual name was only a protected customer name." };
  }

  // Layer 2 — the full Gate Phase, behind the platform flag (same switch as the dispatcher).
  if (!projectGatesEnabled()) {
    return { ok: true, ritualName, nameRewritten };
  }

  const overrideRows = await listGateOverrides(params.ownerId).catch(() => []);
  const overrides: Map<GateName, GateOverrideSnapshot> = new Map(
    overrideRows.map((o) => [
      o.gate_name,
      {
        enabled: o.enabled,
        cleanPassCount: o.clean_pass_count,
        autoDismissEnabled: o.auto_dismiss_enabled,
      },
    ]),
  );

  const llm: GateLlm = async ({ system, user }) => {
    const res = await completeLlm({
      userId: params.ownerId,
      paManagedKey: anthropicKey,
      system,
      messages: [{ role: "user", content: user }],
      maxTokens: 1_200,
    });
    return res.ok ? { ok: true, text: res.text } : { ok: false, error: res.error };
  };

  const findings: string[] = [];
  const phase = await executeGatePhase(
    {
      businessId: params.ownerId,
      projectId: "signal-catcher", // label only — a dropped proposal persists no findings
      goal: params.quote,
      scaffold: scaffoldForSignalProposal({ ...params, ritualName }),
      planVersion: 1,
    },
    {
      readRuleFile: (path) => (repo ? fetchFileContent(repo, path, token) : Promise.resolve(null)),
      llm,
      overrides,
      timeBudgetMs: gateTimeBudgetMs(),
      connectorBudgetUsd: gateConnectorBudgetUsd(),
      now: () => Date.now(),
      persistFindings: async (rows) => {
        for (const r of rows) {
          if (r.finding) findings.push(`${r.gateName}: ${r.finding.rule_violated}`);
        }
      },
      // Signal proposals don't advance the per-gate trust streaks — those belong to Projects.
      recordResult: async () => 0,
    },
  );

  if (phase.verdict !== "clean") {
    return { ok: false, reason: findings[0] ?? "A safety gate could not clear this proposal." };
  }
  return { ok: true, ritualName, nameRewritten };
}
