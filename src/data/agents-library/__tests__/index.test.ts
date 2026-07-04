import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  AGENTS_LIBRARY,
  INDUSTRY_FILTERS,
  INTEGRATIONS,
  LIBRARY_TIER_LABEL,
  USE_CASE_FILTERS,
  agentFitsIndustry,
  agentsForUseCase,
  getLibraryAgent,
  libraryAgentSpec,
} from "..";
import { isAppId } from "@/lib/apps/catalog";
import { USE_CASE_LINKS } from "@/data/use-cases";

const USE_CASE_SLUGS = new Set(USE_CASE_FILTERS.map((f) => f.slug));
const INDUSTRY_SLUGS = new Set(INDUSTRY_FILTERS.map((f) => f.slug));

describe("agents library registry (PA-POS-24)", () => {
  it("ships at least 30 agents with unique slugs", () => {
    expect(AGENTS_LIBRARY.length).toBeGreaterThanOrEqual(30);
    const slugs = new Set(AGENTS_LIBRARY.map((a) => a.slug));
    expect(slugs.size).toBe(AGENTS_LIBRARY.length);
  });

  it("every agent carries 3-5 workflow lines, a completion message, and a tier label", () => {
    for (const agent of AGENTS_LIBRARY) {
      expect(agent.workflow.length, agent.slug).toBeGreaterThanOrEqual(3);
      expect(agent.workflow.length, agent.slug).toBeLessThanOrEqual(5);
      expect(agent.completion.length, agent.slug).toBeGreaterThan(20);
      expect(LIBRARY_TIER_LABEL[agent.tier], agent.slug).toBeTruthy();
    }
  });

  it("every agent references only real Apps, filters, and integrations", () => {
    for (const agent of AGENTS_LIBRARY) {
      expect(agent.appIds.length, agent.slug).toBeGreaterThan(0);
      for (const id of agent.appIds) expect(isAppId(id), `${agent.slug} → ${id}`).toBe(true);
      expect(agent.useCases.length, agent.slug).toBeGreaterThan(0);
      for (const u of agent.useCases) expect(USE_CASE_SLUGS.has(u), `${agent.slug} → ${u}`).toBe(true);
      for (const i of agent.industries) expect(INDUSTRY_SLUGS.has(i), `${agent.slug} → ${i}`).toBe(true);
      expect(agent.integrations.length, agent.slug).toBeGreaterThan(0);
      for (const slug of agent.integrations) {
        expect(INTEGRATIONS[slug], `${agent.slug} → ${slug}`).toBeTruthy();
      }
    }
  });

  it("every integration icon file exists in public/logos/integrations", () => {
    for (const { src } of Object.values(INTEGRATIONS)) {
      expect(existsSync(join(process.cwd(), "public", src)), src).toBe(true);
    }
  });

  it("the lead-generation rail has its six agents and every built use case has coverage", () => {
    expect(agentsForUseCase("lead-generation").length).toBeGreaterThanOrEqual(6);
    for (const useCase of USE_CASE_LINKS) {
      expect(
        agentsForUseCase(useCase.slug).length,
        `use case ${useCase.slug} needs agents for its rail`,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it("lookups behave", () => {
    expect(getLibraryAgent("follow-up-sweep-runner")?.name).toBe("Follow-Up Sweep Runner");
    expect(getLibraryAgent("nope")).toBeNull();
    const untagged = AGENTS_LIBRARY.find((a) => a.industries.length === 0);
    expect(untagged).toBeTruthy();
    if (untagged) expect(agentFitsIndustry(untagged, "real-estate")).toBe(true);
  });

  it("no banned marketing language or jargon in any customer-facing string (chase-spec §10 + lock §2.4/§12)", () => {
    // Slop + jargon a non-technical buyer stumbles on. "deploy" is allowed only inside the
    // product-UI mockups, never in library copy; time estimates are banned outright.
    const banned = [
      /\bunlock/i,
      /\bleverag/i,
      /\bseamless/i,
      /\bsynerg/i,
      /\bsupercharge/i,
      /\belevate\b/i,
      /\bempower/i,
      /\brevolutionary\b/i,
      /game-chang/i,
      /next-level/i,
      /cutting-edge/i,
      /\bgenuinely\b/i,
      /\bhonestly\b/i,
      /\bstraightforward\b/i,
      /\bdeploy/i,
      /\brepos?\b/i,
      /self-host/i,
      /\bAPI\b/,
      /\bSDK\b/,
      /\bOAuth\b/i,
      /\bwebhook/i,
      /\bCI\/CD\b/i,
      /environment variable/i,
      /\bin minutes\b/i,
      /\binstantly\b/i,
      /\bquickly\b/i,
    ];
    for (const agent of AGENTS_LIBRARY) {
      const strings = [agent.name, agent.completion, ...agent.workflow];
      for (const s of strings) {
        for (const pattern of banned) {
          expect(pattern.test(s), `${agent.slug}: "${s}" matches ${pattern}`).toBe(false);
        }
      }
    }
  });
});

describe("libraryAgentSpec (PA-POS-37)", () => {
  // The Clone CTA on /app/agents feeds this straight into POST /api/app/agent-builder/compose,
  // whose Zod boundary is 12-4000 chars — every card must produce a spec that clears it.
  it("produces a compose-route-valid spec for every library agent", () => {
    for (const agent of AGENTS_LIBRARY) {
      const spec = libraryAgentSpec(agent);
      expect(spec.length, agent.slug).toBeGreaterThanOrEqual(12);
      expect(spec.length, agent.slug).toBeLessThanOrEqual(4_000);
      expect(spec, agent.slug).toContain(agent.name);
      for (const step of agent.workflow) expect(spec, agent.slug).toContain(step);
    }
  });
});
