import { describe, it, expect } from "vitest";
import type { Scaffold } from "../../types";
import { aggregateVerdict, GateVerdictSchema, type GateResult } from "../schema";
import { parseProtectedNames, runCustomerNameGate } from "../customer-name";
import { estimateVolume, runConnectorCostGate } from "../connector-cost";
import {
  externalCopyTasks,
  flattenTasks,
  planInvolvesCode,
  producesExternalCopy,
} from "../plan-render";
import { gateTrustWindow, isFindingOverridable, autoDismissUnlocked } from "../trust";
import type { GateContext, GateLlm } from "../types";

// ── fixtures ────────────────────────────────────────────────────────────────────────────

function scaffold(over: Partial<Scaffold> = {}): Scaffold {
  return {
    project: "Spring storm campaign",
    definitionOfDone: "campaign live",
    successCriteria: [],
    milestones: [
      {
        title: "Drip",
        definitionOfDone: "drip sent",
        status: "planned",
        tasks: [
          {
            title: "draft email 3 (social proof)",
            inputs: "testimonials",
            expectedOutput: 'open with "Here\'s what we did for Patrick at Fresh Page"',
            executor: "gmail",
            status: "planned",
          },
        ],
      },
    ],
    ...over,
  };
}

function ctxWith(s: Scaffold, ruleFiles: Record<string, string | null>, budget = 10): GateContext {
  return {
    businessId: "biz-1",
    goal: "launch the campaign",
    scaffold: s,
    ruleFiles: new Map(Object.entries(ruleFiles)),
    involvesCode: planInvolvesCode(s),
    connectorBudgetUsd: budget,
  };
}

const PROTECTED = `# Protected Customer Names\n\n## Protected names\n\n- Alan Stoll\n- Patrick\n- Keaton\n`;

// ── schema ──────────────────────────────────────────────────────────────────────────────

describe("aggregateVerdict", () => {
  const r = (status: GateResult["status"]): GateResult => ({
    gateName: "voice",
    status,
    finding: status === "pass" ? null : {
      rule_violated: "x", rule_source: "y", plan_task_violating: "z",
      severity: "low", suggested_fix: "f", evidence: "e",
    },
    actualMs: 1,
    timeBudgetMs: 60000,
    overridable: false,
  });

  it("all pass → clean", () => {
    expect(aggregateVerdict([r("pass"), r("pass")])).toBe("clean");
  });
  it("a flag → flagged", () => {
    expect(aggregateVerdict([r("pass"), r("flag")])).toBe("flagged");
  });
  it("a hard_fail → blocked (overrides a flag)", () => {
    expect(aggregateVerdict([r("flag"), r("hard_fail")])).toBe("blocked");
  });
  it("an error → blocked (fail closed)", () => {
    expect(aggregateVerdict([r("pass"), r("error")])).toBe("blocked");
  });
});

describe("GateVerdictSchema (the adversarial spine)", () => {
  const finding = {
    rule_violated: "x", rule_source: "y", plan_task_violating: "z",
    severity: "low" as const, suggested_fix: "f", evidence: "e",
  };
  it("accepts a clean pass with no finding", () => {
    expect(GateVerdictSchema.safeParse({ status: "pass" }).success).toBe(true);
  });
  it("rejects a pass that smuggles a finding", () => {
    expect(GateVerdictSchema.safeParse({ status: "pass", finding }).success).toBe(false);
  });
  it("rejects a flag with no finding", () => {
    expect(GateVerdictSchema.safeParse({ status: "flag" }).success).toBe(false);
  });
  it("accepts a flag with a full finding", () => {
    expect(GateVerdictSchema.safeParse({ status: "flag", finding }).success).toBe(true);
  });
});

// ── customer name ───────────────────────────────────────────────────────────────────────

describe("parseProtectedNames", () => {
  it("reads bullets under the heading", () => {
    expect(parseProtectedNames(PROTECTED)?.names).toEqual(["Alan Stoll", "Patrick", "Keaton"]);
  });
  it("strips trailing annotations", () => {
    expect(parseProtectedNames("## Protected names\n- Patrick — a roofer (client)")?.names).toEqual([
      "Patrick",
    ]);
  });
  it("returns null when the section is missing", () => {
    expect(parseProtectedNames("# nothing here")).toBeNull();
  });
  it("returns an empty list for a present-but-empty section", () => {
    expect(parseProtectedNames("## Protected names\n\n## Next")?.names).toEqual([]);
  });
});

describe("runCustomerNameGate", () => {
  it("flags a protected name in external copy", async () => {
    const v = await runCustomerNameGate(ctxWith(scaffold(), { "memory/customer_names_protected.md": PROTECTED }), llmNever);
    expect(v.status).toBe("flag");
    expect(v.finding?.evidence).toContain("Patrick");
  });
  it("passes when no protected name appears", async () => {
    const clean = scaffold({
      milestones: [
        {
          title: "Drip", definitionOfDone: "d", status: "planned",
          tasks: [{ title: "draft email", inputs: "", expectedOutput: "a Tennessee roofer story", executor: "gmail", status: "planned" }],
        },
      ],
    });
    const v = await runCustomerNameGate(ctxWith(clean, { "memory/customer_names_protected.md": PROTECTED }), llmNever);
    expect(v.status).toBe("pass");
  });
  it("does NOT flag an internal-only task (not external copy)", async () => {
    const internal = scaffold({
      milestones: [
        {
          title: "Prep", definitionOfDone: "d", status: "planned",
          tasks: [{ title: "pull Patrick's job file", inputs: "", expectedOutput: "the file", executor: "pocket-agent", status: "planned" }],
        },
      ],
    });
    const v = await runCustomerNameGate(ctxWith(internal, { "memory/customer_names_protected.md": PROTECTED }), llmNever);
    expect(v.status).toBe("pass");
  });
  it("fails closed (throws) on an empty/unreadable rule-file", async () => {
    await expect(
      runCustomerNameGate(ctxWith(scaffold(), { "memory/customer_names_protected.md": "" }), llmNever),
    ).rejects.toThrow();
  });
});

// ── connector cost ──────────────────────────────────────────────────────────────────────

describe("estimateVolume", () => {
  it("reads the largest count, commas stripped", () => {
    expect(estimateVolume({ ...emptyTask, text: "text 4,000 storm leads about 2 things" })).toBe(4000);
  });
  it("defaults to 1 with no count", () => {
    expect(estimateVolume({ ...emptyTask, text: "text the leads" })).toBe(1);
  });
});

describe("runConnectorCostGate", () => {
  it("flags an SMS blast over budget", async () => {
    const blast = scaffold({
      milestones: [
        {
          title: "Blast", definitionOfDone: "d", status: "planned",
          tasks: [{ title: "text 4,000 storm leads", inputs: "", expectedOutput: "sent", executor: "twilio", status: "planned" }],
        },
      ],
    });
    const v = await runConnectorCostGate(ctxWith(blast, {}, 10), llmNever);
    expect(v.status).toBe("flag");
    expect(v.finding?.severity).toBe("high"); // $40 vs $10 → ratio 4
  });
  it("passes a small send under budget", async () => {
    const small = scaffold({
      milestones: [
        {
          title: "Blast", definitionOfDone: "d", status: "planned",
          tasks: [{ title: "text 50 leads", inputs: "", expectedOutput: "sent", executor: "twilio", status: "planned" }],
        },
      ],
    });
    const v = await runConnectorCostGate(ctxWith(small, {}, 10), llmNever);
    expect(v.status).toBe("pass");
  });
  it("passes a plan with no metered connectors", async () => {
    const v = await runConnectorCostGate(ctxWith(scaffold(), {}, 10), llmNever);
    expect(v.status).toBe("pass"); // gmail is not metered
  });
});

// ── plan render ─────────────────────────────────────────────────────────────────────────

describe("plan classifiers", () => {
  it("detects external copy by marker words", () => {
    expect(producesExternalCopy(flattenTasks(scaffold())[0])).toBe(true);
    expect(externalCopyTasks(scaffold())).toHaveLength(1);
  });
  it("detects code plans", () => {
    expect(planInvolvesCode(scaffold({ project: "Build a CRM dashboard" }))).toBe(true);
    expect(planInvolvesCode(scaffold({ project: "Send a thank-you note" }))).toBe(false);
  });
});

// ── trust ───────────────────────────────────────────────────────────────────────────────

describe("trust ladder", () => {
  it("security has a longer window", () => {
    expect(gateTrustWindow("security")).toBeGreaterThan(gateTrustWindow("voice"));
  });
  it("a flag is overridable only when unlocked + enabled", () => {
    expect(isFindingOverridable({ gate: "voice", status: "flag", cleanPassCount: 10, autoDismissEnabled: true })).toBe(true);
    expect(isFindingOverridable({ gate: "voice", status: "flag", cleanPassCount: 3, autoDismissEnabled: true })).toBe(false);
    expect(isFindingOverridable({ gate: "voice", status: "flag", cleanPassCount: 10, autoDismissEnabled: false })).toBe(false);
  });
  it("a security hard_fail is NEVER overridable", () => {
    expect(isFindingOverridable({ gate: "security", status: "hard_fail", cleanPassCount: 999, autoDismissEnabled: true })).toBe(false);
  });
  it("an error is never overridable (fail closed)", () => {
    expect(isFindingOverridable({ gate: "voice", status: "error", cleanPassCount: 999, autoDismissEnabled: true })).toBe(false);
  });
  it("autoDismissUnlocked tracks the window", () => {
    expect(autoDismissUnlocked("voice", 10)).toBe(true);
    expect(autoDismissUnlocked("security", 10)).toBe(false);
  });
});

// ── helpers ─────────────────────────────────────────────────────────────────────────────

const emptyTask = {
  ref: "Milestone 1 · Task 1", milestoneIndex: 0, taskIndex: 0,
  title: "", inputs: "", expectedOutput: "", executor: "twilio", text: "",
};
const llmNever: GateLlm = async () => {
  throw new Error("LLM must not be called by a deterministic gate");
};
