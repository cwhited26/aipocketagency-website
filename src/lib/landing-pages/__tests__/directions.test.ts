// directions.test.ts — Template Gallery invariants + the drift guard (PA-TG-1..2, PA-TG-9).
//
// The brain's BOS/Sites/prompt_library/directions/ is the single source of truth; the generator
// copies each source .md byte-for-byte into src/data/landing-page-templates/directions/ alongside
// the typed catalog it emits. This suite fails when the committed catalog diverges from those
// committed snapshots (the Starter Skills drift-guard pattern) — so a hand-edit of directions.ts, a
// stale re-run, or an orphaned .md all fail loudly.

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DIRECTIONS } from "@/data/landing-page-templates/directions";
import {
  DIRECTION_REF_PREFIX,
  directionRef,
  directionToTemplate,
  getDirection,
  isDirectionRef,
  listDirections,
  loadableFamily,
  paletteRoles,
  resolveLandingTemplate,
  tierAllowsDirection,
} from "../directions";
import { validateTemplate, COPY_PLACEHOLDER } from "../templates";
import { fillTemplate } from "../build";

const MD_DIR = join(process.cwd(), "src", "data", "landing-page-templates", "directions");
const PREVIEW_DIR = join(process.cwd(), "public", "templates");

describe("direction catalog invariants", () => {
  it("ships the full 142-direction catalog with unique slugs (PA-TG-12)", () => {
    expect(DIRECTIONS).toHaveLength(142);
    expect(new Set(DIRECTIONS.map((d) => d.slug)).size).toBe(142);
  });

  it("uses the motionsites-availability ladder: 58 starter / 84 studio_plus (PA-TG-11..12)", () => {
    const counts = DIRECTIONS.reduce<Record<string, number>>((acc, d) => {
      acc[d.tierRequired] = (acc[d.tierRequired] ?? 0) + 1;
      return acc;
    }, {});
    expect(counts).toEqual({ starter: 58, studio_plus: 84 });
  });

  it("preserves the curated 21's tier mappings exactly as PA-TG-11 set them", () => {
    // The full-archive expansion (PA-TG-12) must never move a curated direction's tier. Per
    // BOS/Sites/prompt_library/motionsites-ai-inventory.md: the ten Premium extractions sit at
    // studio_plus, the free extractions + Chase originals at starter.
    const curatedPremium = [
      "bookedup-deep-shadow-saas",
      "cinematic-space-travel-aerospace",
      "codenest-coding-education-dev-platform",
      "cognitra-ai-agency-gray-panel",
      "cyberpunk-red-augmented-self",
      "glassmorphism-purple-pink-agency",
      "mainframe-mouse-scrub-agency",
      "spd-luxury-automation-cinematic",
      "targo-logistics-dark-red-clipped",
      "yacht-club-liquid-cursor-luxury",
    ];
    const curatedStarter = [
      "trades-phone-first-emergency",
      "contractor-photo-first-trust",
      "medspa-booking-calendar-first",
      "real-estate-listing-grid-search",
      "solar-energy-day-night-toggle",
      "vanguard-fierce-creative-collective",
      "prisma-cinematic-cream-collective",
      "jack-3d-creator-portfolio",
      "lithos-geology-editorial",
      "velar-luxury-real-estate",
      "modern-agency-mental-wellness",
    ];
    for (const slug of curatedPremium) {
      expect(getDirection(slug)?.tierRequired, slug).toBe("studio_plus");
    }
    for (const slug of curatedStarter) {
      expect(getDirection(slug)?.tierRequired, slug).toBe("starter");
    }
    // The expansion set only uses the two ladder rungs the availability rule produces.
    for (const d of DIRECTIONS) {
      expect(["starter", "studio_plus"], d.slug).toContain(d.tierRequired);
    }
  });

  it("every direction carries the fields the gallery renders", () => {
    for (const d of DIRECTIONS) {
      expect(d.name.length).toBeGreaterThan(3);
      expect(d.vibe.length).toBeGreaterThan(0);
      expect(d.industries.length).toBeGreaterThan(0);
      expect(d.useCases.length).toBeGreaterThan(0);
      expect(d.colorPalette.length).toBeGreaterThanOrEqual(2);
      for (const c of d.colorPalette) expect(c).toMatch(/^#[0-9a-f]{3,8}$/);
      expect(d.typography.display.length).toBeGreaterThan(1);
      expect(d.typography.body.length).toBeGreaterThan(1);
      expect(d.motifs.length).toBeGreaterThanOrEqual(3);
      expect(d.whenToUse.length).toBeGreaterThanOrEqual(3);
      expect(d.whenNotToUse.length).toBeGreaterThanOrEqual(1);
      expect(["low", "medium", "high"]).toContain(d.buildComplexity);
      expect(d.promptText.length).toBeGreaterThan(500);
      // A preview path must point at a real file the gallery can serve (PA-TG-3); null keeps the
      // styled placeholder card.
      if (d.visualPreview.static !== null) {
        expect(d.visualPreview.static).toBe(`/templates/${d.slug}.png`);
        expect(existsSync(join(PREVIEW_DIR, `${d.slug}.png`))).toBe(true);
      }
      if (d.visualPreview.animated !== null) {
        expect(d.visualPreview.animated).toBe(`/templates/${d.slug}.mp4`);
        expect(existsSync(join(PREVIEW_DIR, `${d.slug}.mp4`))).toBe(true);
      }
    }
  });

  it("every direction with a built mock ships a real preview pair; the remaining gaps stay placeholder-only (PA-TG-13)", () => {
    // PA-TG-13 filled the real-preview wave. Remaining gaps are explicit placeholder-only
    // directions until their mock + capture land.
    const captured = DIRECTIONS.filter((d) => d.visualPreview.static !== null);
    expect(captured).toHaveLength(134);
    for (const d of captured) {
      expect(d.visualPreview.static).toBe(`/templates/${d.slug}.png`);
      expect(d.visualPreview.animated).toBe(`/templates/${d.slug}.mp4`);
    }
    const placeholders = DIRECTIONS.filter((d) => d.visualPreview.static === null);
    expect(placeholders).toHaveLength(8);
    for (const d of placeholders) {
      expect(d.visualPreview.animated, d.slug).toBeNull();
    }
  });
});

describe("drift guard: catalog matches the committed .md snapshots (PA-TG-9)", () => {
  it("every direction has a snapshot whose body equals promptText verbatim", () => {
    for (const d of DIRECTIONS) {
      const raw = readFileSync(join(MD_DIR, `${d.slug}.md`), "utf8");
      expect(raw).toContain(`slug: ${d.slug}`);
      expect(raw).toContain(`name: ${d.name}`);
      const fence = raw.match(/^---\n[\s\S]*?\n---\n?/);
      expect(fence).not.toBeNull();
      const body = raw.slice((fence as RegExpMatchArray)[0].length).trim();
      expect(body).toBe(d.promptText);
    }
  });

  it("has no orphan .md snapshots outside the catalog", () => {
    const files = readdirSync(MD_DIR).filter((f) => f.endsWith(".md"));
    expect(files.length).toBe(DIRECTIONS.length);
  });
});

describe("direction → template synthesis (PA-TG-7)", () => {
  it("every direction synthesizes a valid LandingTemplate the pipeline can build", () => {
    for (const d of DIRECTIONS) {
      const template = directionToTemplate(d);
      expect(validateTemplate(template)).toEqual({ ok: true });
      expect(template.id).toBe(`${DIRECTION_REF_PREFIX}${d.slug}`);
      expect(template.designBrief).toContain(d.name);
      expect(template.designBrief).toContain(d.promptText);
    }
  });

  it("the deterministic fill produces a page that renders the copy and the direction's palette", () => {
    const d = DIRECTIONS.find((x) => x.slug === "velar-luxury-real-estate");
    expect(d).toBeDefined();
    if (!d) return;
    const template = directionToTemplate(d);
    const copy = {
      hero: "Live in irreplaceable\nHomes that don't come around twice.",
      problem: "The problem\nMost listings look the same.",
      mechanism: "How it works\n- We list it\n- We stage it\n- We sell it",
      cta: "Book a showing\nOne call and it's on your calendar.",
    };
    const page = fillTemplate(template, copy);
    expect(page).not.toContain(COPY_PLACEHOLDER);
    expect(page).toContain("export default function");
    expect(page).toContain("Live in irreplaceable");
    // Velar's stated background + deep teal survive into the deterministic build.
    expect(page).toContain("#f5f0ea");
    expect(page).toContain("#213138");
    expect(page).toContain("Syne");
  });

  it("paletteRoles keeps contrast: ink never sits flat on the background", () => {
    for (const d of DIRECTIONS) {
      const roles = paletteRoles(d);
      expect(roles.background).toMatch(/^#/);
      expect(roles.ink).toMatch(/^#/);
      expect(roles.accent).toMatch(/^#/);
      expect(roles.ink.toLowerCase()).not.toBe(roles.background.toLowerCase());
    }
  });

  it("loadableFamily resolves real Google families and rejects descriptive phrases", () => {
    expect(loadableFamily("Syne (Google Fonts, weights 400/700)")).toBe("Syne");
    expect(loadableFamily("Playfair Display ITALIC")).toBe("Playfair Display");
    expect(loadableFamily("a sturdy, legible sans")).toBeNull();
    expect(loadableFamily("SK Reykjavik Rounded Regular")).toBeNull();
  });
});

describe("template resolution + tier gating (PA-TG-2)", () => {
  it("resolves starter ids, direction refs, and rejects unknowns", () => {
    expect(resolveLandingTemplate("single-cta")?.id).toBe("single-cta");
    expect(resolveLandingTemplate(directionRef("velar-luxury-real-estate"))?.label).toContain("Velar");
    expect(resolveLandingTemplate("direction:not-a-direction")).toBeNull();
    expect(resolveLandingTemplate("not-a-template")).toBeNull();
  });

  it("isDirectionRef only matches the prefix", () => {
    expect(isDirectionRef("direction:velar-luxury-real-estate")).toBe(true);
    expect(isDirectionRef("single-cta")).toBe(false);
  });

  it("opens starter directions to every tier and gates the premium set at Studio+ (PA-TG-11)", () => {
    const starterDirection = listDirections().find((d) => d.tierRequired === "starter");
    const premiumDirection = listDirections().find((d) => d.tierRequired === "studio_plus");
    expect(starterDirection).toBeDefined();
    expect(premiumDirection).toBeDefined();
    if (!starterDirection || !premiumDirection) return;
    expect(tierAllowsDirection("starter", starterDirection)).toBe(true);
    expect(tierAllowsDirection("starter", premiumDirection)).toBe(false);
    expect(tierAllowsDirection("pro_plus", premiumDirection)).toBe(false);
    expect(tierAllowsDirection("studio", premiumDirection)).toBe(false);
    expect(tierAllowsDirection("studio_plus", premiumDirection)).toBe(true);
    expect(tierAllowsDirection("enterprise", premiumDirection)).toBe(true);
  });

  it("getDirection round-trips every catalog slug", () => {
    for (const d of listDirections()) {
      expect(getDirection(d.slug)?.name).toBe(d.name);
    }
  });
});
