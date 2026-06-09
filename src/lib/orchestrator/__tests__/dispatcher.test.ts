import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { dispatchUserGoal, deriveToolScopes, buildRunSpec, type DispatcherDeps } from "../dispatcher";
import type { Scaffold, SubAgentRunRow } from "../types";

// A complex goal so isSimpleGoal() doesn't short-circuit the dispatch path.
const COMPLEX_GOAL = "draft the supplement letter for Patrick and stage the invoice";

function scaffoldWith(leafCount: number): Scaffold {
  return {
    project: "Test project",
    definitionOfDone: "done",
    successCriteria: [],
    milestones: [
      {
        title: "Milestone",
        definitionOfDone: "done",
        status: "planned",
        tasks: Array.from({ length: leafCount }, (_, i) => ({
          title: `Task ${i + 1}`,
          inputs: "",
          expectedOutput: "",
          executor: i === 0 ? "gmail" : "pocket-agent",
          status: "planned" as const,
        })),
      },
    ],
  };
}

function makeRow(id: string, businessId: string): SubAgentRunRow {
  return {
    id,
    business_id: businessId,
    originating_message_id: null,
    status: "planning",
    spec_json: {},
    tool_scopes: [],
    time_budget_seconds: 300,
    started_at: null,
    phase_progress: {},
    result_summary: null,
    token_cost: 0,
    agent_minutes: 0,
    created_at: "2026-06-06T00:00:00Z",
    updated_at: "2026-06-06T00:00:00Z",
  };
}

function baseDeps(overrides: Partial<DispatcherDeps> = {}): DispatcherDeps {
  return {
    getTier: vi.fn(async () => "pro" as const),
    countActiveRuns: vi.fn(async () => 0),
    loadContext: vi.fn(async () => ({
      ctx: { availableConnectors: [], availablePersonas: [] },
      brainRepo: null,
      brainToken: null,
    })),
    resolveSkills: vi.fn(async () => []),
    llm: vi.fn(() => async () => ({ ok: true as const, text: JSON.stringify(scaffoldWith(2)) })),
    reserveRun: vi.fn(async (_b: string, minutes: number) => ({
      ok: true as const,
      reservedMinutes: minutes,
      cap: 100,
    })),
    releaseReservation: vi.fn(async () => undefined),
    insertRun: vi.fn(async () => makeRow("run-1", "biz-1")),
    updateRun: vi.fn(async () => null),
    logPhaseEnter: vi.fn(async () => undefined),
    dispatchRuntime: vi.fn(async () => ({ ok: true as const, runtimeJobId: "job-1" })),
    maxConcurrent: vi.fn(() => 5),
    timeBudgetSeconds: vi.fn(() => 300),
    checkBudget: vi.fn(async () => ({
      status: "ok" as const,
      spentMicroCents: 0,
      budgetCents: 10000,
      pct: 0,
    })),
    stageBudgetGateCard: vi.fn(async () => "gate-card-1"),
    ...overrides,
  };
}

const INPUT = { businessId: "biz-1", goal: COMPLEX_GOAL };

describe("dispatchUserGoal", () => {
  beforeEach(() => {
    process.env.PA_ORCHESTRATOR_ENABLED = "true";
  });
  afterEach(() => {
    delete process.env.PA_ORCHESTRATOR_ENABLED;
    vi.restoreAllMocks();
  });

  it("returns disabled when the master flag is off", async () => {
    delete process.env.PA_ORCHESTRATOR_ENABLED;
    const out = await dispatchUserGoal(INPUT, baseDeps());
    expect(out.kind).toBe("disabled");
  });

  it("returns simple for a short read-only goal (no run spawned)", async () => {
    const deps = baseDeps();
    const out = await dispatchUserGoal({ businessId: "biz-1", goal: "what's Patrick's address" }, deps);
    expect(out.kind).toBe("simple");
    expect(deps.insertRun).not.toHaveBeenCalled();
  });

  it("caps when too many runs are already in flight", async () => {
    const deps = baseDeps({ countActiveRuns: vi.fn(async () => 5), maxConcurrent: vi.fn(() => 5) });
    const out = await dispatchUserGoal(INPUT, deps);
    expect(out.kind).toBe("capped");
    expect(deps.insertRun).not.toHaveBeenCalled();
  });

  it("caps when the plan fans out past the tier's sub-agent limit", async () => {
    // pro → max 3 sub-agents; a 4-leaf plan is refused.
    const deps = baseDeps({
      llm: vi.fn(() => async () => ({ ok: true as const, text: JSON.stringify(scaffoldWith(4)) })),
    });
    const out = await dispatchUserGoal(INPUT, deps);
    expect(out.kind).toBe("capped");
    expect(deps.reserveRun).not.toHaveBeenCalled();
  });

  it("caps when the agent-minute reservation is refused", async () => {
    const deps = baseDeps({
      reserveRun: vi.fn(async () => ({ ok: false as const, reason: "over budget" })),
    });
    const out = await dispatchUserGoal(INPUT, deps);
    expect(out.kind).toBe("capped");
    if (out.kind === "capped") expect(out.reason).toBe("over budget");
    expect(deps.insertRun).not.toHaveBeenCalled();
  });

  it("pauses with budget_warn at 80% — no scaffold, no run, no card", async () => {
    const deps = baseDeps({
      checkBudget: vi.fn(async () => ({
        status: "warn_80" as const,
        spentMicroCents: 8_400_000,
        budgetCents: 10000,
        pct: 84,
      })),
    });
    const out = await dispatchUserGoal(INPUT, deps);
    expect(out.kind).toBe("budget_warn");
    if (out.kind === "budget_warn") {
      expect(out.pct).toBe(84);
      expect(out.reason).toContain("84%");
      expect(out.reason).toContain("$100");
    }
    expect(deps.insertRun).not.toHaveBeenCalled();
    expect(deps.reserveRun).not.toHaveBeenCalled();
    expect(deps.stageBudgetGateCard).not.toHaveBeenCalled();
  });

  it("gates with budget_gated at 100% — stages the Mission Control card, fires nothing", async () => {
    const deps = baseDeps({
      checkBudget: vi.fn(async () => ({
        status: "block_100" as const,
        spentMicroCents: 10_200_000,
        budgetCents: 10000,
        pct: 102,
      })),
    });
    const out = await dispatchUserGoal(INPUT, deps);
    expect(out.kind).toBe("budget_gated");
    if (out.kind === "budget_gated") expect(out.inboxItemId).toBe("gate-card-1");
    expect(deps.stageBudgetGateCard).toHaveBeenCalledTimes(1);
    expect(deps.insertRun).not.toHaveBeenCalled();
    expect(deps.dispatchRuntime).not.toHaveBeenCalled();
  });

  it("dispatches: persists the run, fires it, logs OBSERVE", async () => {
    const deps = baseDeps();
    const out = await dispatchUserGoal(INPUT, deps);
    expect(out.kind).toBe("dispatched");
    if (out.kind === "dispatched") {
      expect(out.dispatched).toBe(true);
      expect(out.runId).toBe("run-1");
    }
    expect(deps.insertRun).toHaveBeenCalledTimes(1);
    expect(deps.dispatchRuntime).toHaveBeenCalledTimes(1);
    expect(deps.updateRun).toHaveBeenCalledWith("run-1", expect.objectContaining({ status: "running" }));
    expect(deps.logPhaseEnter).toHaveBeenCalledWith("run-1", "observe", expect.any(String));
  });

  it("plan-only when the runtime is not configured (nothing fires)", async () => {
    const deps = baseDeps({
      dispatchRuntime: vi.fn(async () => ({ ok: false as const, degraded: "not_configured" as const })),
    });
    const out = await dispatchUserGoal(INPUT, deps);
    expect(out.kind).toBe("dispatched");
    if (out.kind === "dispatched") expect(out.dispatched).toBe(false);
    // The run is saved but never marked running, and no reservation is released.
    expect(deps.releaseReservation).not.toHaveBeenCalled();
  });

  it("releases the reservation + marks the run failed when the runtime errors", async () => {
    const deps = baseDeps({
      dispatchRuntime: vi.fn(async () => ({
        ok: false as const,
        degraded: "error" as const,
        error: "boom",
      })),
    });
    const out = await dispatchUserGoal(INPUT, deps);
    expect(out.kind).toBe("dispatched");
    if (out.kind === "dispatched") expect(out.dispatched).toBe(false);
    expect(deps.releaseReservation).toHaveBeenCalledTimes(1);
    expect(deps.updateRun).toHaveBeenCalledWith("run-1", expect.objectContaining({ status: "failed" }));
  });
});

describe("deriveToolScopes", () => {
  it("collects connector executors, excluding pocket-agent", () => {
    expect(deriveToolScopes(scaffoldWith(2))).toEqual(["gmail"]);
  });
});

describe("buildRunSpec", () => {
  it("builds a run-level ISA carrying the scaffold + scopes", () => {
    const scaffold = scaffoldWith(2);
    const spec = buildRunSpec("the goal", scaffold, ["gmail"]);
    expect(spec.objective).toBe("the goal");
    expect(spec.toolScopes).toEqual(["gmail"]);
    expect(spec.definitionOfDone).toBe(scaffold.definitionOfDone);
    // Default zone is recorded so the sub-agent knows its containment scope.
    expect(spec.readZones).toEqual(["project-shared"]);
  });

  it("injects loaded Skills as `## Learned techniques` context (PA-SKILL-6)", () => {
    const scaffold = scaffoldWith(2);
    const spec = buildRunSpec("draft a supplement", scaffold, [], {
      loadedSkills: [{ slug: "draft-roof-supplement-quote", name: "Draft Roof Supplement Quote", body: "Step 1. Read the photos." }],
      runZone: "project-shared",
    });
    const ctx = spec.context as {
      learnedTechniques: { slug: string }[];
      learnedTechniquesMarkdown: string;
    };
    expect(ctx.learnedTechniques).toHaveLength(1);
    expect(ctx.learnedTechniques[0].slug).toBe("draft-roof-supplement-quote");
    expect(ctx.learnedTechniquesMarkdown).toContain("## Learned techniques");
    expect(ctx.learnedTechniquesMarkdown).toContain("Draft Roof Supplement Quote");
  });
});

describe("dispatchUserGoal · Skills", () => {
  beforeEach(() => {
    process.env.PA_ORCHESTRATOR_ENABLED = "true";
  });
  afterEach(() => {
    delete process.env.PA_ORCHESTRATOR_ENABLED;
    vi.restoreAllMocks();
  });

  it("resolves Skills for the run's zone and carries them into the dispatched spec", async () => {
    const resolveSkills = vi.fn(async () => [
      { slug: "draft-roof-supplement-quote", name: "Draft Roof Supplement Quote", body: "Read photos." },
    ]);
    const dispatchRuntime = vi.fn(async (_job: unknown) => ({ ok: true as const, runtimeJobId: "job-1" }));
    const deps = baseDeps({
      loadContext: vi.fn(async () => ({
        ctx: { availableConnectors: [], availablePersonas: [] },
        brainRepo: "owner/brain",
        brainToken: null,
      })),
      resolveSkills,
      dispatchRuntime,
    });
    await dispatchUserGoal({ businessId: "biz-1", goal: COMPLEX_GOAL }, deps);
    expect(resolveSkills).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: "biz-1", repo: "owner/brain", runZone: "project-shared" }),
    );
    const job = dispatchRuntime.mock.calls[0][0] as unknown as { spec: { context: { learnedTechniques: unknown[] } } };
    expect(job.spec.context.learnedTechniques).toHaveLength(1);
  });

  it("skips Skill resolution entirely when the owner has no brain repo", async () => {
    const resolveSkills = vi.fn(async () => []);
    const deps = baseDeps({ resolveSkills });
    await dispatchUserGoal({ businessId: "biz-1", goal: COMPLEX_GOAL }, deps);
    expect(resolveSkills).not.toHaveBeenCalled();
  });
});
