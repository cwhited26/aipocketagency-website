// verticals.test.ts — the vertical registry (PA-POS-22) stays wired to the shipped persona
// templates and the /for/[persona] marketing pages. Pins the two vertical→Persona mappings the
// spec names outright (coaches, contractors), the 3-Personas-per-vertical contract, and the
// skip path (an empty seed plan — the owner asked for the empty workspace).

import { describe, expect, it } from "vitest";
import {
  VERTICALS,
  VERTICAL_SLUGS,
  getVertical,
  isVerticalSlug,
  planVerticalSeed,
  suggestedAppsForVertical,
  verticalForMarketingSlug,
  verticalTemplates,
} from "../verticals";
import { getTemplate, isTemplateKey } from "@/lib/personas/templates";
import { isAppId } from "@/lib/apps/catalog";
import { PERSONA_LINKS } from "@/data/marketing/persona-pages";

describe("VERTICALS registry", () => {
  it("ships exactly six verticals with unique slugs", () => {
    expect(VERTICALS).toHaveLength(6);
    expect(new Set(VERTICALS.map((v) => v.slug)).size).toBe(6);
    expect(VERTICAL_SLUGS).toEqual(VERTICALS.map((v) => v.slug));
  });

  it("every vertical seeds exactly three shipped role templates", () => {
    for (const v of VERTICALS) {
      expect(v.personaTemplates).toHaveLength(3);
      expect(new Set(v.personaTemplates).size).toBe(3);
      for (const key of v.personaTemplates) {
        expect(isTemplateKey(key), `${v.slug} references unknown template ${key}`).toBe(true);
      }
      expect(verticalTemplates(v)).toHaveLength(3);
    }
  });

  it("every vertical's example agent is one of its seeded templates", () => {
    for (const v of VERTICALS) {
      expect(v.personaTemplates).toContain(v.exampleTemplate);
    }
  });

  it("every vertical maps onto a shipped /for/[persona] page and back", () => {
    const marketingSlugs = new Set(PERSONA_LINKS.map((p) => p.slug));
    for (const v of VERTICALS) {
      expect(marketingSlugs.has(v.marketingSlug), `${v.slug} → ${v.marketingSlug}`).toBe(true);
      expect(verticalForMarketingSlug(v.marketingSlug)?.slug).toBe(v.slug);
    }
    // And every marketing page has a vertical behind it — the picker and the six doors agree.
    for (const p of PERSONA_LINKS) {
      expect(verticalForMarketingSlug(p.slug), `no vertical for /for/${p.slug}`).not.toBeNull();
    }
  });

  it("pins the spec-named seeds: coaches and contractors", () => {
    expect(getVertical("coach")?.personaTemplates).toEqual(["admin", "sales", "content"]);
    expect(getVertical("contractor")?.personaTemplates).toEqual(["admin", "followup", "ops-cos"]);
  });

  it("suggested Apps are the union of the seeded templates' defaultApps, all catalog-valid", () => {
    for (const v of VERTICALS) {
      const apps = suggestedAppsForVertical(v);
      expect(apps.length).toBeGreaterThan(0);
      expect(new Set(apps).size).toBe(apps.length);
      for (const id of apps) expect(isAppId(id)).toBe(true);
      const union = new Set(verticalTemplates(v).flatMap((t) => t.defaultApps));
      expect(new Set(apps)).toEqual(union);
    }
  });
});

describe("planVerticalSeed", () => {
  it("plans three Personas + their Apps for each of the six verticals", () => {
    for (const slug of VERTICAL_SLUGS) {
      const plan = planVerticalSeed(slug);
      expect(plan.vertical).toBe(slug);
      expect(plan.templates).toEqual(getVertical(slug)?.personaTemplates);
      expect(plan.apps.length).toBeGreaterThan(0);
    }
  });

  it("skip (null) plans an empty workspace — no Personas, no Apps", () => {
    const plan = planVerticalSeed(null);
    expect(plan.vertical).toBeNull();
    expect(plan.templates).toEqual([]);
    expect(plan.apps).toEqual([]);
  });
});

describe("isVerticalSlug", () => {
  it("accepts the six slugs and rejects everything else", () => {
    for (const slug of VERTICAL_SLUGS) expect(isVerticalSlug(slug)).toBe(true);
    expect(isVerticalSlug("skip")).toBe(false);
    expect(isVerticalSlug("coaches")).toBe(false);
    expect(isVerticalSlug("")).toBe(false);
  });
});

describe("template avatar wiring (PA-POS-23)", () => {
  it("every vertical's avatarSlug is its own slug; every seeded template carries an avatarSlug", () => {
    for (const v of VERTICALS) {
      expect(v.avatarSlug).toBe(v.slug);
      for (const key of v.personaTemplates) {
        expect(getTemplate(key)?.avatarSlug).toBeTruthy();
      }
    }
  });
});
