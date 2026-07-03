// parse.test.ts — round-trips 5 example owner specs through parseAgentSpec against a mock
// model (test a per the lane brief): the model's JSON comes back as a Zod-validated
// ParsedIntent, the cost ledger sees exactly one agent_builder row per parse with the
// deterministic idempotency key, and malformed output maps to a clean 422.

import { describe, it, expect, vi } from "vitest";
import { AgentSpecParseError, parseAgentSpec, type ParseDeps } from "../parse";
import type { ParsedIntent } from "../types";

type Example = {
  spec: string;
  modelJson: Record<string, unknown>;
  expect: Partial<ParsedIntent>;
};

const EXAMPLES: Example[] = [
  {
    spec: "Watch my Gmail for adjuster emails and draft SRA responses in my voice.",
    modelJson: {
      summary: "Watch Gmail for adjuster emails and draft SRA responses in the owner's voice",
      jobNoun: "Adjuster Follow-Up",
      role: "email",
      watches: "Gmail inbox for adjuster emails",
      does: "Drafts SRA responses in the owner's voice and stages them for approval",
      voice: "owner",
      schedule: null,
      brainZones: ["voice", "customers"],
      capabilities: ["draft_email"],
      neededTechniques: ["insurance adjuster reply"],
    },
    expect: { role: "email", voice: "owner", schedule: null },
  },
  {
    spec: "Every Monday at 8am, sweep my pipeline for quotes with no reply and draft follow-ups.",
    modelJson: {
      summary: "Weekly sweep of quotes with no reply, drafting follow-ups",
      jobNoun: "Quote Chase",
      role: "followup",
      watches: "the pipeline for quotes with no reply",
      does: "Drafts a follow-up for each quiet quote",
      voice: "owner",
      schedule: "every Monday 8am",
      brainZones: ["customers"],
      capabilities: ["follow_up", "recurring_schedule"],
      neededTechniques: ["quote follow-up"],
    },
    expect: { role: "followup", schedule: "every Monday 8am" },
  },
  {
    spec: "Watch my competitors' sites and tell me when their pricing changes.",
    modelJson: {
      summary: "Watch competitor sites for pricing changes",
      jobNoun: "Pricing Watch",
      role: "lead_research",
      watches: "competitor websites",
      does: "Reports pricing changes to the owner",
      voice: "neutral",
      schedule: null,
      brainZones: ["competitive"],
      capabilities: ["watch_competitor", "watch_website"],
      neededTechniques: [],
    },
    expect: { role: "lead_research", voice: "neutral" },
  },
  {
    spec: "Read my Skool comments and draft on-brand replies for me to approve.",
    modelJson: {
      summary: "Draft on-brand replies to Skool comments for approval",
      jobNoun: "Community Replies",
      role: "content",
      watches: "Skool community comments",
      does: "Drafts replies in the owner's voice, staged for approval",
      voice: "owner",
      schedule: null,
      brainZones: ["voice"],
      capabilities: ["draft_email"],
      neededTechniques: ["community reply tone"],
    },
    expect: { role: "content" },
  },
  {
    spec: "Find roofing companies near Knoxville without a website and draft a first-touch email to each.",
    modelJson: {
      summary: "Find local roofers without websites and draft first-touch outreach",
      jobNoun: "Roofer Outreach",
      role: "sales",
      watches: "",
      does: "Scores each business and drafts a first-touch email",
      voice: "owner",
      schedule: null,
      brainZones: ["voice", "customers"],
      capabilities: ["find_leads", "draft_email"],
      neededTechniques: ["cold intro structure"],
    },
    expect: { role: "sales" },
  },
];

function depsReturning(text: string): ParseDeps & { logCost: ReturnType<typeof vi.fn> } {
  const logCost = vi.fn(async () => undefined);
  return {
    complete: vi.fn(async () => ({
      ok: true as const,
      text,
      inputTokens: 300,
      outputTokens: 150,
      provider: "pa_managed" as const,
      model: "claude-sonnet-4-6",
      qualityWarning: false,
      usedFallback: false,
      fallbackReason: null,
    })),
    logCost,
  };
}

describe("parseAgentSpec", () => {
  it.each(EXAMPLES.map((e, i) => [i + 1, e] as const))(
    "round-trips example spec %d into a validated intent",
    async (_n, example) => {
      const deps = depsReturning(JSON.stringify(example.modelJson));
      const intent = await parseAgentSpec(
        {
          ownerId: "owner-1",
          buildId: `build-${_n}`,
          specText: example.spec,
          paManagedKey: "sk-test",
        },
        deps,
      );
      for (const [key, value] of Object.entries(example.expect)) {
        expect(intent[key as keyof ParsedIntent]).toEqual(value);
      }
      // Exactly one ledger row, deterministic key, agent_builder slug, Sonnet on the row.
      expect(deps.logCost).toHaveBeenCalledTimes(1);
      const [cost, backend, model] = deps.logCost.mock.calls[0];
      expect(cost).toMatchObject({
        ownerId: "owner-1",
        featureSlug: "agent_builder",
        idempotencyKey: `agent_builder:parse:build-${_n}`,
      });
      expect(backend).toBe("anthropic");
      expect(model).toBe("claude-sonnet-4-6");
    },
  );

  it("tolerates prose around the JSON object", async () => {
    const deps = depsReturning(
      `Here is the intent:\n${JSON.stringify(EXAMPLES[0].modelJson)}\nDone.`,
    );
    const intent = await parseAgentSpec(
      { ownerId: "o", buildId: "b", specText: EXAMPLES[0].spec, paManagedKey: "k" },
      deps,
    );
    expect(intent.role).toBe("email");
  });

  it("rejects an intent outside the shipped enums (composition boundary)", async () => {
    const rogue = { ...EXAMPLES[0].modelJson, capabilities: ["write_arbitrary_code"] };
    const deps = depsReturning(JSON.stringify(rogue));
    await expect(
      parseAgentSpec(
        { ownerId: "o", buildId: "b", specText: "spec text here", paManagedKey: "k" },
        deps,
      ),
    ).rejects.toThrowError(AgentSpecParseError);
  });

  it("maps non-JSON output to a 422 AgentSpecParseError", async () => {
    const deps = depsReturning("I could not decide.");
    await expect(
      parseAgentSpec(
        { ownerId: "o", buildId: "b", specText: "spec text here", paManagedKey: "k" },
        deps,
      ),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("maps a provider failure to a 502 without a ledger row", async () => {
    const logCost = vi.fn(async () => undefined);
    const deps: ParseDeps = {
      complete: vi.fn(async () => ({ ok: false as const, status: 500, error: "down" })),
      logCost,
    };
    await expect(
      parseAgentSpec(
        { ownerId: "o", buildId: "b", specText: "spec text here", paManagedKey: "k" },
        deps,
      ),
    ).rejects.toMatchObject({ status: 502 });
    expect(logCost).not.toHaveBeenCalled();
  });
});
