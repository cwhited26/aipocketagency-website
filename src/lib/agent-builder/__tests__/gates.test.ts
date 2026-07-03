// gates.test.ts — test c: the Gate Phase refuses a composed spec that carries a protected
// customer name (the always-on layer-1 scan), and passes a clean one. The full gate library
// (layer 2) stays behind PA_PROJECT_GATES_ENABLED and is exercised via the runner's own tests.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/pa-supabase", () => ({ fetchPaUser: vi.fn() }));
vi.mock("@/lib/pa-brain", () => ({ fetchFileContent: vi.fn() }));
vi.mock("@/lib/llm/dispatch", () => ({ completeLlm: vi.fn() }));
vi.mock("@/lib/orchestrator/gates/runner", () => ({ executeGatePhase: vi.fn() }));
vi.mock("@/lib/orchestrator/gates/db", () => ({ listGateOverrides: vi.fn(async () => []) }));
vi.mock("@/lib/orchestrator/gates/config", () => ({
  projectGatesEnabled: vi.fn(() => false),
  gateTimeBudgetMs: vi.fn(() => 60_000),
  gateConnectorBudgetUsd: vi.fn(() => 10),
}));

import { runAgentBuildGates, scaffoldForAgentBuild } from "../gates";
import { fetchPaUser } from "@/lib/pa-supabase";
import { fetchFileContent } from "@/lib/pa-brain";
import { ComposedAgentSchema, type ComposedAgent } from "../types";

const mockFetchPaUser = vi.mocked(fetchPaUser);
const mockFetchFile = vi.mocked(fetchFileContent);

const PROTECTED_NAMES_MD = [
  "# Customer names",
  "",
  "## Protected names",
  "",
  "- Alan Hanes — restoration client",
  "- Maria Delgado",
].join("\n");

function composedWith(specText: string): ComposedAgent {
  return ComposedAgentSchema.parse({
    buildId: "b1",
    specText,
    intent: {
      summary: "Draft follow-ups for quiet quotes",
      jobNoun: "Quote Chase",
      role: "followup",
      watches: "the pipeline",
      does: "Drafts a follow-up for each quiet quote",
      voice: "owner",
      schedule: null,
      brainZones: ["customers"],
      capabilities: ["follow_up"],
      neededTechniques: [],
    },
    personaTemplateKey: "followup",
    personaName: "Follow-Up Agent — Quote Chase",
    personaSlug: "follow-up-agent-quote-chase",
    tone: "direct",
    starterPrompt: "Run a first pass now",
    customFields: {},
    apps: ["follow-up-sweeps", "email-drafter"],
    skillSlugs: ["quote-follow-up"],
    brainScopes: ["voice", "customers"],
    schedule: null,
    candidateSkill: null,
  });
}

describe("runAgentBuildGates — customer-name layer", () => {
  beforeEach(() => {
    mockFetchPaUser.mockReset();
    mockFetchFile.mockReset();
    mockFetchPaUser.mockResolvedValue({
      ok: true,
      data: { brain_repo: "owner/brain", github_token: "gh-token", anthropic_api_key: "sk" },
    } as unknown as Awaited<ReturnType<typeof fetchPaUser>>);
    mockFetchFile.mockResolvedValue(PROTECTED_NAMES_MD);
  });

  it("refuses a spec that names a protected customer, with a rewrite suggestion", async () => {
    const outcome = await runAgentBuildGates({
      ownerId: "owner-1",
      composed: composedWith("Follow up with Alan Hanes about the mold remediation quote"),
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).toContain("Alan Hanes");
      expect(outcome.suggestion.length).toBeGreaterThan(0);
    }
  });

  it("passes a clean spec (flag off → layer 1 only)", async () => {
    const outcome = await runAgentBuildGates({
      ownerId: "owner-1",
      composed: composedWith("Follow up with quiet quotes from the pipeline"),
    });
    expect(outcome.ok).toBe(true);
  });

  it("passes when there's no brain yet — nothing to protect", async () => {
    mockFetchPaUser.mockResolvedValue({
      ok: true,
      data: { brain_repo: null, github_token: null, anthropic_api_key: null },
    } as unknown as Awaited<ReturnType<typeof fetchPaUser>>);
    const outcome = await runAgentBuildGates({
      ownerId: "owner-1",
      composed: composedWith("Follow up with Alan Hanes"),
    });
    expect(outcome.ok).toBe(true);
  });
});

describe("scaffoldForAgentBuild", () => {
  it("frames the composed agent as external-facing copy, not a code plan", () => {
    const scaffold = scaffoldForAgentBuild(composedWith("Chase quiet quotes"));
    expect(scaffold.milestones).toHaveLength(1);
    const task = scaffold.milestones[0].tasks[0];
    expect(task.expectedOutput).toContain("owner's voice");
    expect(task.expectedOutput.toLowerCase()).not.toContain("code");
  });
});
