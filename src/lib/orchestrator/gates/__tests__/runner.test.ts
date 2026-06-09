import { describe, it, expect, vi } from "vitest";
import type { Scaffold } from "../../types";
import { executeGatePhase, type GatePhaseDeps, type GateOverrideSnapshot } from "../runner";
import { auditViaLlm, GateAuditError } from "../llm-audit";
import type { GateLlm } from "../types";
import type { GateName } from "../schema";

// A simple non-code plan with no external-facing copy and no metered connectors. On such a plan:
// voice passes (nothing to audit), customer_name + connector_cost pass deterministically, decision
// + security run the LLM, code_convention + test are skipped (non-code).
function plainPlan(): Scaffold {
  return {
    project: "Reconcile last month's books",
    definitionOfDone: "books reconciled",
    successCriteria: [],
    milestones: [
      {
        title: "Reconcile",
        definitionOfDone: "done",
        status: "planned",
        tasks: [
          { title: "match the invoices", inputs: "ledger", expectedOutput: "matched", executor: "pocket-agent", status: "planned" },
        ],
      },
    ],
  };
}

const PROTECTED = "## Protected names\n- Patrick\n- Keaton\n";
const RULE_FILES: Record<string, string> = {
  "memory/customer_names_protected.md": PROTECTED,
  "APA/Decision_Log.md": "APA-1: ship it.",
  "CLAUDE.md": "§5: no any.",
  "voice/chase-spec.md": "plain english.",
  "memory/feedback_secrets_via_1password.md": "secrets in 1password.",
};

const PASS_LLM: GateLlm = async () => ({ ok: true, text: '{"status":"pass"}' });

function deps(over: Partial<GatePhaseDeps> = {}): GatePhaseDeps {
  return {
    readRuleFile: async (p) => RULE_FILES[p] ?? null,
    llm: PASS_LLM,
    overrides: new Map<GateName, GateOverrideSnapshot>(),
    timeBudgetMs: 1_000,
    connectorBudgetUsd: 10,
    now: () => 0,
    persistFindings: vi.fn(async () => undefined),
    recordResult: vi.fn(async () => 1),
    ...over,
  };
}

const INPUT = { businessId: "biz-1", projectId: "run-1", goal: "reconcile", scaffold: plainPlan(), planVersion: 1 };

describe("executeGatePhase", () => {
  it("clean: every applicable gate passes → verdict clean, findings + streaks persisted", async () => {
    const d = deps();
    const out = await executeGatePhase(INPUT, d);
    expect(out.verdict).toBe("clean");
    // 5 always-gates run (voice, customer_name, decision, security, connector_cost); code gates skip.
    expect(out.results).toHaveLength(5);
    expect(out.results.every((r) => r.status === "pass")).toBe(true);
    expect(d.persistFindings).toHaveBeenCalledTimes(1);
    expect(d.recordResult).toHaveBeenCalledTimes(5);
  });

  it("flagged: a protected name in external copy → flagged, not blocked", async () => {
    const plan = plainPlan();
    plan.milestones[0].tasks[0] = {
      title: "draft the launch email",
      inputs: "",
      expectedOutput: 'open with "thanks Patrick"',
      executor: "gmail",
      status: "planned",
    };
    const out = await executeGatePhase({ ...INPUT, scaffold: plan }, deps());
    expect(out.verdict).toBe("flagged");
    expect(out.results.find((r) => r.gateName === "customer_name")?.status).toBe("flag");
  });

  it("blocked (fail closed): a required rule-file that can't be read errors its gate", async () => {
    const d = deps({ readRuleFile: async (p) => (p === "memory/customer_names_protected.md" ? null : RULE_FILES[p] ?? null) });
    const out = await executeGatePhase(INPUT, d);
    expect(out.verdict).toBe("blocked");
    expect(out.results.find((r) => r.gateName === "customer_name")?.status).toBe("error");
  });

  it("blocked (fail closed): malformed LLM output errors the judgment gates", async () => {
    const d = deps({ llm: async () => ({ ok: true, text: "not json at all" }) });
    const out = await executeGatePhase(INPUT, d);
    expect(out.verdict).toBe("blocked");
    expect(out.results.find((r) => r.gateName === "decision")?.status).toBe("error");
  });

  it("blocked (fail closed): a gate that blows its time budget errors", async () => {
    const slow: GateLlm = () => new Promise((resolve) => setTimeout(() => resolve({ ok: true, text: '{"status":"pass"}' }), 50));
    // Real clock so the timeout fires; tiny budget.
    const d = deps({ llm: slow, timeBudgetMs: 5, now: () => Date.now() });
    const out = await executeGatePhase(INPUT, d);
    expect(out.verdict).toBe("blocked");
    expect(out.results.find((r) => r.gateName === "security")?.status).toBe("error");
  });

  it("honors a disabled gate (owner turned it off)", async () => {
    const overrides = new Map<GateName, GateOverrideSnapshot>([
      ["security", { enabled: false, cleanPassCount: 0, autoDismissEnabled: false }],
    ]);
    const out = await executeGatePhase(INPUT, deps({ overrides }));
    expect(out.results.find((r) => r.gateName === "security")).toBeUndefined();
  });
});

describe("auditViaLlm", () => {
  it("returns a validated pass", async () => {
    const v = await auditViaLlm({ system: "s", user: "u", llm: async () => ({ ok: true, text: '{"status":"pass"}' }) });
    expect(v.status).toBe("pass");
  });
  it("throws when the model returns no JSON", async () => {
    await expect(
      auditViaLlm({ system: "s", user: "u", llm: async () => ({ ok: true, text: "nope" }) }),
    ).rejects.toBeInstanceOf(GateAuditError);
  });
  it("throws on a pass that smuggles a finding (refinement)", async () => {
    const text = '{"status":"pass","finding":{"rule_violated":"x","rule_source":"y","plan_task_violating":"z","severity":"low","suggested_fix":"f","evidence":"e"}}';
    await expect(
      auditViaLlm({ system: "s", user: "u", llm: async () => ({ ok: true, text }) }),
    ).rejects.toBeInstanceOf(GateAuditError);
  });
  it("throws when the LLM itself errors (fail closed)", async () => {
    await expect(
      auditViaLlm({ system: "s", user: "u", llm: async () => ({ ok: false, error: "down" }) }),
    ).rejects.toBeInstanceOf(GateAuditError);
  });
});
