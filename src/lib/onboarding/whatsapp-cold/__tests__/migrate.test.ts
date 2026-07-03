import { describe, expect, it } from "vitest";
import { composedAgentFromTrial } from "../migrate";
import { ComposedAgentSchema } from "@/lib/agent-builder/types";
import type { TrialComposed } from "../types";

const TRIAL: TrialComposed = {
  specText: "Setup a Sales agent for me",
  intent: {
    summary: "Draft and chase sales follow-ups",
    jobNoun: "Sales Follow-Up",
    role: "sales",
    watches: "",
    does: "Drafts follow-up emails for stale leads",
    voice: "owner",
    schedule: "every Monday 8am",
    brainZones: [],
    capabilities: ["follow_up"],
    neededTechniques: [],
  },
  personaTemplateKey: "sales",
  personaName: "Sales Assistant — Sales Follow-Up",
  personaSlug: "sales-assistant-sales-follow-up",
  tone: "direct",
  starterPrompt: "Run a first pass now: Draft and chase sales follow-ups",
  customFields: { goal: "Draft and chase sales follow-ups" },
  apps: ["follow-up-sweeps"],
  skillSlugs: ["quote-follow-up"],
};

describe("composedAgentFromTrial (§22.1 step 8 migration)", () => {
  it("rebuilds a schema-valid ComposedAgent for the approval card", () => {
    const composed = composedAgentFromTrial("build-1", TRIAL, [
      "Runs a med spa in Alpharetta",
      "Wants Google and Yelp reviews handled",
    ]);
    const parsed = ComposedAgentSchema.parse(composed);
    expect(parsed.buildId).toBe("build-1");
    expect(parsed.personaSlug).toBe(TRIAL.personaSlug);
    expect(parsed.schedule).toBe("every Monday 8am");
    // Brain scopes stay empty — the owner grants zones on the card in their own workspace.
    expect(parsed.brainScopes).toEqual([]);
    expect(parsed.candidateSkill).toBeNull();
  });

  it("migrates the accumulated Business Brain facts as trial context", () => {
    const composed = composedAgentFromTrial("build-1", TRIAL, ["Runs a med spa in Alpharetta"]);
    expect(composed.customFields.trial_context).toContain("med spa in Alpharetta");
    // The original composed fields survive untouched.
    expect(composed.customFields.goal).toBe("Draft and chase sales follow-ups");

    const bare = composedAgentFromTrial("build-2", TRIAL, []);
    expect("trial_context" in bare.customFields).toBe(false);
  });
});
