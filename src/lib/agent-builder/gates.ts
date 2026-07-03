// gates.ts — the Gate Phase treatment for composed agents (§19: gates run against the composed
// spec BEFORE the approval card renders). Same two-layer shape as the Browser Agent's gates:
//
//   1. ALWAYS: the deterministic Customer Name scan over the owner's spec + every composed
//      string that becomes external-facing copy (persona name, starter prompt, candidate Skill).
//      A protected name in an agent that drafts emails is exactly the leak the gate exists to
//      stop. A missing protected-names file means nothing to protect yet — pass, don't brick.
//
//   2. WHEN PA_PROJECT_GATES_ENABLED: the full gate library (voice / customer name / decision /
//      security / connector cost — the code gates skip, a composed agent isn't a code plan)
//      over a one-task scaffold built from the composed agent. Findings summarize onto the
//      refusal; verdict 'blocked'/'flagged' refuses the compose (fail closed, PA-GATE-4).

import { fetchPaUser } from "@/lib/pa-supabase";
import { fetchFileContent } from "@/lib/pa-brain";
import { completeLlm } from "@/lib/llm/dispatch";
import { ScaffoldSchema, type Scaffold } from "@/lib/orchestrator/types";
import {
  executeGatePhase,
  type GateOverrideSnapshot,
} from "@/lib/orchestrator/gates/runner";
import type { GateLlm } from "@/lib/orchestrator/gates/types";
import type { GateName } from "@/lib/orchestrator/gates/schema";
import { listGateOverrides } from "@/lib/orchestrator/gates/db";
import {
  gateConnectorBudgetUsd,
  gateTimeBudgetMs,
  projectGatesEnabled,
} from "@/lib/orchestrator/gates/config";
import { parseProtectedNames } from "@/lib/orchestrator/gates/customer-name";
import type { ComposedAgent } from "./types";

const PROTECTED_FILE = "memory/customer_names_protected.md";

export type AgentBuildGateOutcome =
  | { ok: true; findings: AgentBuildGateFinding[] }
  | { ok: false; reason: string; suggestion: string };

export type AgentBuildGateFinding = {
  gate: string;
  status: string;
  ruleViolated: string;
  suggestedFix: string;
};

/** Every composed string that leaves the workspace as copy, joined for the scans. */
export function externalCopyOf(composed: ComposedAgent): string {
  return [
    composed.specText,
    composed.personaName,
    composed.starterPrompt,
    composed.intent.summary,
    composed.intent.does,
    composed.candidateSkill?.name ?? "",
    composed.candidateSkill?.description ?? "",
    composed.candidateSkill?.body ?? "",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * The one-task scaffold the gate library audits. The task text frames the composed agent's
 * output as external-facing copy (the Voice + Customer Name scope) without tripping the
 * code-plan markers — a composed agent is a composition, not a code plan.
 */
export function scaffoldForAgentBuild(composed: ComposedAgent): Scaffold {
  return ScaffoldSchema.parse({
    project: `Compose a new agent: ${composed.personaName}`.slice(0, 490),
    definitionOfDone:
      "The composed agent is approved by the owner and its config lives in the owner's Business Brain repo.",
    successCriteria: [],
    milestones: [
      {
        title: "Composed agent",
        definitionOfDone: "",
        tasks: [
          {
            title: `Run the "${composed.intent.jobNoun}" job as the owner's agent`.slice(0, 490),
            inputs: `Owner's spec: ${composed.specText.slice(0, 600)}. Watches: ${composed.intent.watches.slice(0, 200)}`,
            expectedOutput:
              "Emails, messages, and drafts written in the owner's voice and staged for approval — external-facing copy sent on the owner's behalf.",
            executor: "agent_builder",
          },
        ],
      },
    ],
  });
}

function escapeForRegex(name: string): string {
  return name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Layer 1: the deterministic protected-name scan over the composed copy. */
async function scanComposedForProtectedNames(params: {
  ownerId: string;
  composed: ComposedAgent;
}): Promise<{ hit: string[] } | null> {
  const paRes = await fetchPaUser(params.ownerId);
  const repo = paRes.ok && paRes.data ? paRes.data.brain_repo : null;
  const token = paRes.ok && paRes.data ? paRes.data.github_token : null;
  if (!repo) return null; // no brain → nothing to protect yet

  const content = await fetchFileContent(repo, PROTECTED_FILE, token).catch(() => null);
  if (!content || !content.trim()) return null;
  const parsed = parseProtectedNames(content);
  if (!parsed || parsed.names.length === 0) return null;

  const copy = externalCopyOf(params.composed);
  const hits = parsed.names.filter((n) =>
    new RegExp(`\\b${escapeForRegex(n)}\\b`, "i").test(copy),
  );
  return hits.length > 0 ? { hit: [...new Set(hits)] } : null;
}

/** Runs the gate treatment for a composed agent, before the approval card is staged. */
export async function runAgentBuildGates(params: {
  ownerId: string;
  composed: ComposedAgent;
}): Promise<AgentBuildGateOutcome> {
  // Layer 1 — always on.
  const nameHit = await scanComposedForProtectedNames(params);
  if (nameHit) {
    const names = nameHit.hit.join(", ");
    return {
      ok: false,
      reason: `The spec mentions ${names} — a protected customer name. A composed agent drafts customer-facing copy, so real customer names never ride along.`,
      suggestion:
        'Rewrite the spec without the name — describe them instead (e.g. "a repeat commercial customer") or reference the record by its file path in your brain.',
    };
  }

  // Layer 2 — the full Gate Phase, behind the platform flag (same switch as the dispatcher).
  if (!projectGatesEnabled()) {
    return { ok: true, findings: [] };
  }

  const paRes = await fetchPaUser(params.ownerId);
  const repo = paRes.ok && paRes.data ? paRes.data.brain_repo : null;
  const token = paRes.ok && paRes.data ? paRes.data.github_token : null;
  const anthropicKey = paRes.ok && paRes.data ? (paRes.data.anthropic_api_key ?? "") : "";

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

  const collected: AgentBuildGateFinding[] = [];
  const phase = await executeGatePhase(
    {
      businessId: params.ownerId,
      projectId: "agent-build", // label only — findings persist on the refusal, not pa_gate_findings
      goal: params.composed.specText,
      scaffold: scaffoldForAgentBuild(params.composed),
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
          if (r.finding) {
            collected.push({
              gate: r.gateName,
              status: r.status,
              ruleViolated: r.finding.rule_violated,
              suggestedFix: r.finding.suggested_fix,
            });
          }
        }
      },
      // Composed-agent gates don't advance the per-gate trust streaks — those belong to Projects.
      recordResult: async () => 0,
    },
  );

  if (phase.verdict !== "clean") {
    const first = collected[0];
    return {
      ok: false,
      reason: first
        ? `${first.gate} gate: ${first.ruleViolated}`
        : "A safety gate could not clear this agent.",
      suggestion: first?.suggestedFix ?? "Revise the spec and compose again.",
    };
  }
  return { ok: true, findings: collected };
}
