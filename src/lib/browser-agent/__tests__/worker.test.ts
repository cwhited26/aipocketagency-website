import { describe, it, expect, vi } from "vitest";
import { advanceJob, type WorkerDeps, type WorkerSession } from "../worker";
import type { BrowserJobRow, ElementInfo } from "../types";
import type { ComputerUseResult } from "../computer-use";

// ── fixtures ─────────────────────────────────────────────────────────────────────────────

function jobRow(overrides: Partial<BrowserJobRow>): BrowserJobRow {
  return {
    id: "job-1",
    owner_id: "owner-1",
    workspace_id: null,
    agent_persona_id: null,
    intent: "Pull the fee schedule from the permits page",
    starting_url: "https://portal.example.com/permits",
    status: "running",
    current_step: 1,
    max_steps: 50,
    max_wall_seconds: 1800,
    max_cost_micro_cents: 5_000_000,
    cost_micro_cents_estimate: 0,
    state_json: {
      messages: [{ role: "user", content: [{ type: "text", text: "Task: …" }] }],
      browserbase: { sessionId: "bb-1", connectUrl: "wss://connect.example" },
      browserSecondsAccrued: 0,
    },
    browserbase_session_id: "bb-1",
    pending_step: null,
    gate_findings: null,
    result_summary: null,
    error: null,
    lease_until: null,
    started_at: new Date().toISOString(),
    completed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function linkElement(): ElementInfo {
  return {
    tag: "a",
    inputType: null,
    role: null,
    text: "Fee schedule",
    ariaLabel: null,
    href: "https://portal.example.com/fees",
    inForm: false,
    isPasswordField: false,
    autocomplete: null,
  };
}

function submitElement(): ElementInfo {
  return {
    tag: "input",
    inputType: "submit",
    role: null,
    text: "Submit application",
    ariaLabel: null,
    href: null,
    inForm: true,
    isPasswordField: false,
    autocomplete: null,
  };
}

function clickToolUse(): ComputerUseResult {
  return {
    ok: true,
    stopReason: "tool_use",
    usage: { input_tokens: 1_000, output_tokens: 100 },
    content: [
      { type: "text", text: "Clicking the fee schedule link." },
      { type: "tool_use", id: "toolu_1", name: "computer", input: { action: "left_click", coordinate: [120, 240] } },
    ],
  };
}

function makeDeps(params: {
  element: ElementInfo | null;
  computerUse: ComputerUseResult[];
  clockStepMs?: number;
}): { deps: WorkerDeps; calls: Record<string, unknown[][]>; session: WorkerSession } {
  const calls: Record<string, unknown[][]> = {
    updateJob: [],
    insertStep: [],
    stageApproval: [],
    callComputerUse: [],
    logStepCost: [],
    releaseSession: [],
  };
  let t = 0;
  let cuIndex = 0;
  const session: WorkerSession = {
    executeAction: vi.fn(async () => undefined),
    hitTest: vi.fn(async () => params.element),
    focusedElement: vi.fn(async () => params.element),
    screenshot: vi.fn(async () => "cGl4ZWxz"),
    currentUrl: () => "https://portal.example.com/permits",
    close: vi.fn(async () => undefined),
  };
  const deps: WorkerDeps = {
    updateJob: async (...args) => {
      calls.updateJob.push(args);
      return { ok: true };
    },
    insertStep: async (...args) => {
      calls.insertStep.push(args);
      return { ok: true };
    },
    markStepApproval: async () => undefined,
    fetchInboxStatus: async () => "pending",
    stageApproval: async (...args) => {
      calls.stageApproval.push(args);
      return { ok: true, inboxItemId: "inbox-1" };
    },
    callComputerUse: async (...args) => {
      calls.callComputerUse.push(args);
      const result = params.computerUse[Math.min(cuIndex, params.computerUse.length - 1)];
      cuIndex += 1;
      return result;
    },
    createSession: async () => ({ ok: true, sessionId: "bb-1", connectUrl: "wss://connect.example" }),
    connectSession: async () => session,
    releaseSession: async (...args) => {
      calls.releaseSession.push(args);
    },
    storeScreenshot: async () => ({ ok: true, objectPath: "owner-1/job-1/2.png" }),
    logStepCost: async (...args) => {
      calls.logStepCost.push(args);
    },
    now: () => {
      t += params.clockStepMs ?? 30_000;
      return t;
    },
  };
  return { deps, calls, session };
}

// ── SPEC test (c): the cron worker advances a running job one step and saves state ───────

describe("advanceJob — advances a running job one step and saves state", () => {
  it("plans, executes, records the step, and persists the conversation", async () => {
    const { deps, calls, session } = makeDeps({
      element: linkElement(),
      computerUse: [clickToolUse()],
      // Big clock steps: the budget check trips after the first full iteration.
      clockStepMs: 30_000,
    });

    const outcome = await advanceJob(jobRow({}), deps, 100_000);

    // One planning call, one executed action, one step row at step 2.
    expect(calls.callComputerUse.length).toBe(1);
    expect(session.executeAction).toHaveBeenCalledTimes(1);
    expect(calls.insertStep.length).toBe(1);
    const step = calls.insertStep[0][0] as { stepNumber: number; actionKind: string };
    expect(step.stepNumber).toBe(2);
    expect(step.actionKind).toBe("click");

    // Cost logged for the step.
    expect(calls.logStepCost.length).toBe(1);

    // State saved: the last job update carries the conversation with the tool_result appended.
    const lastUpdate = calls.updateJob[calls.updateJob.length - 1][1] as {
      status: string;
      current_step: number;
      state_json: { messages: Array<{ role: string }> };
    };
    expect(lastUpdate.status).toBe("running");
    expect(lastUpdate.current_step).toBe(2);
    // initial user msg + assistant tool_use + user tool_result
    expect(lastUpdate.state_json.messages.length).toBe(3);
    expect(outcome.status).toBe("running");
    expect(outcome.stepsAdvanced).toBe(1);

    // The CDP handle is always closed at the end of a tick.
    expect(session.close).toHaveBeenCalled();
  });
});

// ── SPEC test (b): the cost cap halts a runaway job ──────────────────────────────────────

describe("advanceJob — cost cap halts a runaway job", () => {
  it("fails the job at the cap before another planning call is made", async () => {
    const { deps, calls } = makeDeps({
      element: linkElement(),
      computerUse: [clickToolUse()],
      clockStepMs: 100,
    });

    const job = jobRow({ cost_micro_cents_estimate: 5_000_000 }); // at the $5.00 cap
    const outcome = await advanceJob(job, deps, 100_000);

    expect(outcome.status).toBe("failed");
    expect(calls.callComputerUse.length).toBe(0); // never spends past the cap
    const finalUpdate = calls.updateJob[calls.updateJob.length - 1][1] as { error: string };
    expect(finalUpdate.error).toContain("Cost cap");
    // Terminal job releases the Browserbase session.
    expect(calls.releaseSession.length).toBe(1);
  });
});

// ── The approval gate parks the job behind a Mission Control card ────────────────────────

describe("advanceJob — irreversible action stages an approval and parks the job", () => {
  it("a submit click goes to awaiting_approval with a held step", async () => {
    const { deps, calls, session } = makeDeps({
      element: submitElement(),
      computerUse: [clickToolUse()],
      clockStepMs: 100,
    });

    const outcome = await advanceJob(jobRow({}), deps, 100_000);

    expect(outcome.status).toBe("awaiting_approval");
    expect(calls.stageApproval.length).toBe(1);
    expect(session.executeAction).not.toHaveBeenCalled(); // the held action did NOT run
    const step = calls.insertStep[0][0] as { actionKind: string; approvalStatus: string };
    expect(step.actionKind).toBe("awaiting_approval");
    expect(step.approvalStatus).toBe("pending");
    const lastUpdate = calls.updateJob[calls.updateJob.length - 1][1] as {
      status: string;
      pending_step: { inboxItemId: string };
    };
    expect(lastUpdate.status).toBe("awaiting_approval");
    expect(lastUpdate.pending_step.inboxItemId).toBe("inbox-1");
  });
});

// ── The model finishing (no tool call) completes the job ─────────────────────────────────

describe("advanceJob — model finishing completes the job", () => {
  it("plain text with no tool_use lands as result_summary + completed", async () => {
    const { deps, calls } = makeDeps({
      element: linkElement(),
      computerUse: [
        {
          ok: true,
          stopReason: "end_turn",
          usage: { input_tokens: 800, output_tokens: 120 },
          content: [{ type: "text", text: "The residential reroof fee is $150. Done." }],
        },
      ],
      clockStepMs: 100,
    });

    const outcome = await advanceJob(jobRow({}), deps, 100_000);

    expect(outcome.status).toBe("completed");
    const finalUpdate = calls.updateJob[calls.updateJob.length - 1][1] as {
      status: string;
      result_summary: string;
    };
    expect(finalUpdate.status).toBe("completed");
    expect(finalUpdate.result_summary).toContain("$150");
    expect(calls.releaseSession.length).toBe(1);
  });
});
