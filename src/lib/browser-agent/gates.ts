// gates.ts — the Gate Phase treatment for browser jobs (Browser Agent SPEC: gates run before
// the job starts). Two layers:
//
//   1. ALWAYS: the deterministic Customer Name scan. The intent is text the agent will type
//      into live web pages, so a protected name in it is exactly the leak the gate exists to
//      stop. Runs regardless of the platform flag; a hit refuses the job with the gate's
//      rewrite suggestion. A missing/absent protected-names file means nothing to protect yet
//      (a brand-new brain) — the scan passes rather than bricking the feature.
//
//   2. WHEN PA_PROJECT_GATES_ENABLED: the full seven-gate phase (voice / customer name /
//      decision / code convention / security / test / connector cost) over a one-task scaffold
//      built from the intent. Findings persist ON THE JOB ROW — pa_gate_findings FKs
//      project_id to pa_sub_agent_runs, which a browser job is not, so the runner's default
//      persistence can't be used; the deps-injected executeGatePhase takes ours instead.
//      Verdict 'blocked' or 'flagged' refuses the job (fail closed, PA-GATE-4) with the
//      finding's suggested_fix as the rewrite suggestion.

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

const PROTECTED_FILE = "memory/customer_names_protected.md";

export type GateOutcome =
  | { ok: true; findings: GateFindingSummary[] }
  | { ok: false; reason: string; suggestion: string };

export type GateFindingSummary = {
  gate: string;
  status: string;
  ruleViolated: string;
  suggestedFix: string;
};

/**
 * The one-task scaffold the gates audit. The task text carries the intent + the "message /
 * typed text on pages" framing so plan-render classifies it as external-facing copy (the
 * Voice + Customer Name scope) without tripping the code-plan markers.
 */
export function scaffoldForBrowserJob(intent: string, startingUrl: string): Scaffold {
  return ScaffoldSchema.parse({
    project: `Operate a live browser session: ${intent.slice(0, 400)}`,
    definitionOfDone: "The browser task is complete and the owner has a step-by-step record.",
    successCriteria: [],
    milestones: [
      {
        title: "Browser session",
        definitionOfDone: "",
        tasks: [
          {
            title: "Drive the page to complete the owner's task",
            inputs: `Starting page: ${startingUrl}. Task: ${intent.slice(0, 700)}`,
            expectedOutput:
              "Clicks, typed text, and any message or form content entered on live pages during the session.",
            executor: "browser_agent",
          },
        ],
      },
    ],
  });
}

function escapeForRegex(name: string): string {
  return name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Layer 1: the deterministic protected-name scan over the raw intent. */
async function scanIntentForProtectedNames(params: {
  ownerId: string;
  intent: string;
}): Promise<{ hit: string[] } | null> {
  const paRes = await fetchPaUser(params.ownerId);
  const repo = paRes.ok && paRes.data ? paRes.data.brain_repo : null;
  const token = paRes.ok && paRes.data ? paRes.data.github_token : null;
  if (!repo) return null; // no brain → nothing to protect yet

  const content = await fetchFileContent(repo, PROTECTED_FILE, token).catch(() => null);
  if (!content || !content.trim()) return null;
  const parsed = parseProtectedNames(content);
  if (!parsed || parsed.names.length === 0) return null;

  const hits = parsed.names.filter((n) =>
    new RegExp(`\\b${escapeForRegex(n)}\\b`, "i").test(params.intent),
  );
  return hits.length > 0 ? { hit: [...new Set(hits)] } : null;
}

/**
 * Runs the gate treatment for a new browser job. `jobId` labels the findings (they persist on
 * the job row via the returned summaries, not in pa_gate_findings).
 */
export async function runBrowserJobGates(params: {
  ownerId: string;
  intent: string;
  startingUrl: string;
}): Promise<GateOutcome> {
  // Layer 1 — always on.
  const nameHit = await scanIntentForProtectedNames({
    ownerId: params.ownerId,
    intent: params.intent,
  });
  if (nameHit) {
    const names = nameHit.hit.join(", ");
    return {
      ok: false,
      reason: `The task mentions ${names} — a protected customer name. Browser jobs type text into live pages, so real customer names never ride along.`,
      suggestion: `Rewrite the task without the name — describe them instead (e.g. "a Tennessee roofing contractor") or reference the record by its file path in your brain.`,
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

  const collected: GateFindingSummary[] = [];
  const phase = await executeGatePhase(
    {
      businessId: params.ownerId,
      projectId: "browser-job", // label only — our persistFindings keeps them on the job
      goal: params.intent,
      scaffold: scaffoldForBrowserJob(params.intent, params.startingUrl),
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
      // Browser jobs don't advance the per-gate trust streaks — those belong to Projects.
      recordResult: async () => 0,
    },
  );

  if (phase.verdict !== "clean") {
    const first = collected[0];
    return {
      ok: false,
      reason: first
        ? `${first.gate} gate: ${first.ruleViolated}`
        : "A safety gate could not clear this job.",
      suggestion: first?.suggestedFix ?? "Revise the task and try again.",
    };
  }
  return { ok: true, findings: collected };
}
