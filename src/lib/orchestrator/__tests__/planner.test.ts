import { describe, it, expect } from "vitest";
import {
  isSimpleGoal,
  extractJsonObject,
  parseScaffold,
  fallbackScaffold,
  buildScaffold,
  scaffoldToMarkdown,
  projectSlug,
  specForTask,
  type PlannerContext,
  type PlannerLlm,
} from "../planner";
import { estimateAgentMinutes, type Scaffold } from "../types";

const CTX: PlannerContext = { availableConnectors: ["gmail"], availablePersonas: [] };

const VALID_SCAFFOLD: Scaffold = {
  project: "Send Patrick the supplement",
  definitionOfDone: "Patrick has the supplement letter + email.",
  successCriteria: ["Email drafted", "Invoice queued"],
  milestones: [
    {
      title: "Prepare docs",
      definitionOfDone: "Letter generated",
      status: "planned",
      tasks: [
        {
          title: "Generate supplement letter",
          inputs: "inspection photos",
          expectedOutput: "supplement-letter.pdf",
          executor: "pocket-agent",
          status: "planned",
        },
      ],
    },
    {
      title: "Send",
      definitionOfDone: "Email staged",
      status: "planned",
      tasks: [
        {
          title: "Draft email with attachment",
          inputs: "letter",
          expectedOutput: "email draft",
          executor: "gmail",
          status: "planned",
        },
      ],
    },
  ],
};

describe("isSimpleGoal", () => {
  it("treats short read-only lookups as simple", () => {
    expect(isSimpleGoal("what's Patrick's address")).toBe(true);
    expect(isSimpleGoal("show me my open leads")).toBe(true);
    expect(isSimpleGoal("who is my newest customer")).toBe(true);
  });
  it("stays conservative — an action-verb substring forces a plan", () => {
    // "invoices" contains the action verb "invoice" → scaffold, don't answer inline.
    expect(isSimpleGoal("how many invoices are unpaid")).toBe(false);
  });
  it("treats action verbs as not simple", () => {
    expect(isSimpleGoal("email Patrick the proposal")).toBe(false);
    expect(isSimpleGoal("draft a supplement letter")).toBe(false);
  });
  it("treats multi-clause goals as not simple", () => {
    expect(isSimpleGoal("pull Patrick's file and draft the letter")).toBe(false);
    expect(isSimpleGoal("find the invoice; then send a reminder")).toBe(false);
  });
  it("treats very long goals as not simple", () => {
    expect(isSimpleGoal("show me " + "x".repeat(200))).toBe(false);
  });
});

describe("extractJsonObject", () => {
  it("extracts a fenced json block", () => {
    const out = extractJsonObject('prose\n```json\n{"a":1}\n```\nmore');
    expect(out).toBe('{"a":1}');
  });
  it("extracts a bare balanced object", () => {
    expect(extractJsonObject('noise {"a":{"b":2}} tail')).toBe('{"a":{"b":2}}');
  });
  it("returns null when no object present", () => {
    expect(extractJsonObject("no json here")).toBeNull();
  });
  it("does not trip on braces inside strings", () => {
    expect(extractJsonObject('{"k":"a}b"}')).toBe('{"k":"a}b"}');
  });
});

describe("parseScaffold", () => {
  it("parses a valid scaffold JSON", () => {
    const scaffold = parseScaffold(JSON.stringify(VALID_SCAFFOLD));
    expect(scaffold?.project).toBe("Send Patrick the supplement");
    expect(scaffold?.milestones).toHaveLength(2);
  });
  it("returns null for malformed JSON", () => {
    expect(parseScaffold("{not json")).toBeNull();
  });
  it("returns null for valid JSON that fails the schema", () => {
    expect(parseScaffold('{"project":"x"}')).toBeNull(); // missing milestones
  });
});

describe("fallbackScaffold", () => {
  it("is a single-milestone single-task plan derived from the goal", () => {
    const fb = fallbackScaffold("fix the QuickBooks export");
    expect(fb.milestones).toHaveLength(1);
    expect(fb.milestones[0].tasks).toHaveLength(1);
    expect(fb.project).toContain("QuickBooks");
  });
});

describe("buildScaffold (mock LLM)", () => {
  it("uses the LLM plan when it returns valid JSON", async () => {
    const llm: PlannerLlm = async () => ({ ok: true, text: JSON.stringify(VALID_SCAFFOLD) });
    const { scaffold, usedFallback } = await buildScaffold("goal", CTX, llm);
    expect(usedFallback).toBe(false);
    expect(scaffold.milestones).toHaveLength(2);
  });
  it("falls back when the LLM errors", async () => {
    const llm: PlannerLlm = async () => ({ ok: false, error: "no key" });
    const { usedFallback } = await buildScaffold("fix the bug", CTX, llm);
    expect(usedFallback).toBe(true);
  });
  it("falls back when the LLM returns garbage", async () => {
    const llm: PlannerLlm = async () => ({ ok: true, text: "I cannot help with that." });
    const { usedFallback } = await buildScaffold("fix the bug", CTX, llm);
    expect(usedFallback).toBe(true);
  });
  it("never throws even when the LLM call rejects", async () => {
    const llm: PlannerLlm = async () => {
      throw new Error("network down");
    };
    const { usedFallback } = await buildScaffold("fix the bug", CTX, llm);
    expect(usedFallback).toBe(true);
  });
});

describe("specForTask", () => {
  it("derives a sub-agent ISA from a scaffold leaf", () => {
    const spec = specForTask(VALID_SCAFFOLD, 1, 0, ["gmail"], ["project-shared"]);
    expect(spec.objective).toBe("Draft email with attachment");
    expect(spec.toolScopes).toEqual(["gmail"]);
    expect(spec.readZones).toEqual(["project-shared"]);
    expect(spec.context.milestone).toBe("Send");
  });
});

describe("estimateAgentMinutes", () => {
  it("scales with leaf count and time budget", () => {
    // 2 leaves × 300s/60 = 10 minutes
    expect(estimateAgentMinutes(VALID_SCAFFOLD, 300)).toBe(10);
    // floors at 0.1 for a tiny plan
    expect(estimateAgentMinutes(fallbackScaffold("x"), 1)).toBeGreaterThanOrEqual(0.1);
  });
});

describe("projectSlug + scaffoldToMarkdown", () => {
  it("slugifies a title", () => {
    expect(projectSlug("Send Patrick the Supplement!")).toBe("send-patrick-the-supplement");
    expect(projectSlug("")).toBe("project");
  });
  it("renders markdown with milestones + tasks", () => {
    const md = scaffoldToMarkdown(VALID_SCAFFOLD, "2026-06-06T00:00:00Z");
    expect(md).toContain("# Project: Send Patrick the supplement");
    expect(md).toContain("Milestone 1");
    expect(md).toContain("Draft email with attachment");
  });
});
