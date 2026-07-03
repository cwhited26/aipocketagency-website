import { describe, expect, it, vi } from "vitest";
import { composeTrialAgent } from "../compose";
import { TrialComposedSchema } from "../types";
import { isAppId } from "@/lib/apps/catalog";

const INTENT_JSON = JSON.stringify({
  summary: "Draft and chase sales follow-ups for stale leads",
  jobNoun: "Sales Follow-Up",
  role: "sales",
  watches: "",
  does: "Drafts follow-up emails for leads that went quiet",
  voice: "owner",
  schedule: null,
  brainZones: ["voice", "customers"],
  capabilities: ["follow_up", "draft_email"],
  neededTechniques: [],
});

function okCompletion(text: string) {
  return {
    ok: true as const,
    text,
    inputTokens: 100,
    outputTokens: 50,
    provider: "anthropic" as const,
    model: "claude-sonnet-4-6",
    qualityWarning: false,
    usedFallback: false,
    fallbackReason: null,
  };
}

const PARAMS = {
  senderPhone: "15551234567",
  specText: "Setup a Sales agent for me. I want to hire it as my first AI employee.",
  anthropicKey: "sk-test",
};

describe("composeTrialAgent (§22.2 — trimmed Agent Builder composition)", () => {
  it("composes a valid trial profile from one message", async () => {
    const result = await composeTrialAgent(PARAMS, {
      complete: vi.fn(async () => okCompletion(INTENT_JSON)),
    });
    if (!result.ok) throw new Error("compose expected to succeed");
    const composed = TrialComposedSchema.parse(result.composed);

    // Persona composes from the shipped template with the job-noun suffix.
    expect(composed.personaName).toContain("Sales Follow-Up");
    expect(composed.personaSlug.length).toBeGreaterThan(0);
    // Toolkit resolves to real shipped Apps only.
    expect(composed.apps.length).toBeGreaterThan(0);
    for (const id of composed.apps) expect(isAppId(id), id).toBe(true);
    // Trimmed: the intent may name brain zones, but the TRIAL profile carries none — there is
    // no repo to scope until the owner converts (§22.2).
    expect("brainScopes" in composed).toBe(false);
    expect("candidateSkill" in composed).toBe(false);
  });

  it("reports parse_miss on a non-spec message (model 422 path)", async () => {
    const result = await composeTrialAgent(
      { ...PARAMS, specText: "hi" },
      { complete: vi.fn(async () => okCompletion("hello, how can I help?")) },
    );
    expect(result).toEqual({ ok: false, reason: "parse_miss" });
  });

  it("reports unavailable when the provider is down", async () => {
    const result = await composeTrialAgent(PARAMS, {
      complete: vi.fn(async () => ({ ok: false as const, status: 529, error: "overloaded" })),
    });
    expect(result).toEqual({ ok: false, reason: "unavailable" });
  });
});
