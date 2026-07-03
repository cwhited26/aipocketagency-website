// compose.test.ts — test b: the deterministic compose picks the correct role template for
// each intent, names the persona so it can never shadow a shipped template, maps
// capabilities onto shipped Apps only, and drafts a candidate Skill ONLY when the shipped
// pack has no match.

import { describe, it, expect } from "vitest";
import { composePersona, templateKeyForRole } from "../compose-persona";
import { composeToolkit } from "../compose-toolkit";
import { composeSkills } from "../compose-skills";
import { composeBrainScopes } from "../compose-brain-scopes";
import { ParsedIntentSchema, type ParsedIntent } from "../types";
import { listTemplates } from "@/lib/personas/templates";
import { isAppId } from "@/lib/apps/catalog";
import { STARTER_SKILL_MANIFEST } from "@/data/starter-skills/manifest";

function intentOf(overrides: Partial<ParsedIntent>): ParsedIntent {
  return ParsedIntentSchema.parse({
    summary: "Watch Gmail for adjuster emails and draft responses",
    jobNoun: "Adjuster Follow-Up",
    role: "email",
    watches: "Gmail",
    does: "Drafts responses in the owner's voice",
    voice: "owner",
    schedule: null,
    brainZones: ["voice"],
    capabilities: ["draft_email"],
    neededTechniques: [],
    ...overrides,
  });
}

describe("composePersona", () => {
  const CASES: Array<[ParsedIntent["role"], string]> = [
    ["sales", "sales"],
    ["followup", "followup"],
    ["email", "email"],
    ["content", "content"],
    ["lead_research", "lead-research"],
    ["admin", "admin"],
    ["ops", "ops-cos"],
    ["support", "vcsa"],
    ["recruiting", "vr"],
    ["marketing", "vmd"],
  ];

  it.each(CASES)("role %s → shipped template %s", (role, templateKey) => {
    expect(templateKeyForRole(role)).toBe(templateKey);
    const composed = composePersona({ intent: intentOf({ role }), existingNames: [] });
    expect(composed.templateKey).toBe(templateKey);
  });

  it("never composes a name that duplicates a shipped template's suggested name", () => {
    for (const [role] of CASES) {
      const composed = composePersona({ intent: intentOf({ role }), existingNames: [] });
      for (const shipped of listTemplates()) {
        expect(composed.name.toLowerCase()).not.toBe(shipped.suggestedName.toLowerCase());
      }
      // The job noun is the suffix that keeps it distinct.
      expect(composed.name).toContain("Adjuster Follow-Up");
    }
  });

  it("suffixes numerically when the owner already has the composed name", () => {
    const first = composePersona({ intent: intentOf({}), existingNames: [] });
    const second = composePersona({
      intent: intentOf({}),
      existingNames: [first.name],
    });
    expect(second.name).toBe(`${first.name} 2`);
    expect(second.slug).not.toBe(first.slug);
  });

  it("binds the owner's voice into the constraints when voice=owner", () => {
    const composed = composePersona({ intent: intentOf({ voice: "owner" }), existingNames: [] });
    expect(composed.customFields.constraints).toContain("owner's voice");
    const neutral = composePersona({ intent: intentOf({ voice: "neutral" }), existingNames: [] });
    expect(neutral.customFields.constraints).toBeUndefined();
  });

  it("sets the starter prompt from the parsed intent", () => {
    const composed = composePersona({ intent: intentOf({}), existingNames: [] });
    expect(composed.starterPrompt).toContain("Watch Gmail for adjuster emails");
  });
});

describe("composeToolkit", () => {
  it("maps every capability onto shipped catalog Apps only", () => {
    const apps = composeToolkit(
      intentOf({ capabilities: ["draft_email", "find_leads", "watch_competitor"] }),
    );
    expect(apps.length).toBeGreaterThan(0);
    for (const app of apps) expect(isAppId(app)).toBe(true);
    expect(apps).toContain("email-drafter");
    expect(apps).toContain("lead-scout");
    expect(apps).toContain("competitor-inspector");
  });

  it("adds the Ritual Scheduler when the intent carries a schedule", () => {
    const withSchedule = composeToolkit(intentOf({ schedule: "every Monday 8am" }));
    expect(withSchedule).toContain("ritual-scheduler");
    const onDemand = composeToolkit(intentOf({ schedule: null }));
    expect(onDemand).not.toContain("ritual-scheduler");
  });
});

describe("composeSkills", () => {
  it("matches shipped starter Skills for a covered technique — no candidate drafted", () => {
    const { skillSlugs, candidateSkill } = composeSkills(
      intentOf({
        summary: "Chase quotes that have gone quiet",
        does: "Drafts a quote follow-up email for each stale quote",
        neededTechniques: ["quote follow-up"],
      }),
    );
    expect(skillSlugs.length).toBeGreaterThan(0);
    const manifestSlugs = new Set(STARTER_SKILL_MANIFEST.map((r) => r.slug));
    for (const slug of skillSlugs) expect(manifestSlugs.has(slug)).toBe(true);
    expect(candidateSkill).toBeNull();
  });

  it("drafts ONE candidate Skill when a needed technique isn't in the shipped pack", () => {
    const { candidateSkill } = composeSkills(
      intentOf({
        summary: "Respond to insurance adjusters about storm claims",
        does: "Drafts SRA responses",
        neededTechniques: ["xactimate supplement negotiation"],
      }),
    );
    expect(candidateSkill).not.toBeNull();
    expect(candidateSkill?.slug).toBe("xactimate-supplement-negotiation");
    // The draft describes a working loop over shipped primitives, never code.
    expect(candidateSkill?.body).toContain("Stage the output in Mission Control");
  });
});

describe("composeBrainScopes", () => {
  it("adds voice for owner-voice agents and customers for customer-facing capabilities", () => {
    const scopes = composeBrainScopes(
      intentOf({ brainZones: ["competitive"], voice: "owner", capabilities: ["draft_email"] }),
    );
    expect(scopes).toContain("voice");
    expect(scopes).toContain("customers");
    expect(scopes).toContain("competitive");
  });

  it("stays narrow for a neutral watcher", () => {
    const scopes = composeBrainScopes(
      intentOf({
        brainZones: ["competitive"],
        voice: "neutral",
        capabilities: ["watch_competitor"],
      }),
    );
    expect(scopes).toEqual(["competitive"]);
  });
});
