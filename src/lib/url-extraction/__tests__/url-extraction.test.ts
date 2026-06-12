// url-extraction.test.ts — the pure layers of the extraction worker: color math, slugs, the
// inference heuristics, the state-diff primitive, and the YAML serializer.

import { describe, expect, it } from "vitest";
import { approxLuminance, cssColorToOklch, isTransparent, parseCssColor } from "../oklch";
import { sourceSlugFromUrl } from "../types";
import {
  buildPalette,
  buildRadius,
  buildShadows,
  buildSpacing,
  buildTypography,
  classifyArchetype,
  inferInteractionModel,
  type AuditSection,
  type PageAudit,
} from "../infer";
import { diffSnapshots, renderExtractionLog } from "../extract";
import { serializeDesignDna, serializeSourceMeta, yamlScalar } from "../serialize";
import { dnaFixture } from "./fixtures";
import type { Behavior, SourceMeta } from "../types";

// ── Fixtures ────────────────────────────────────────────────────────────────────────────────

function auditFixture(overrides: Partial<PageAudit> = {}): PageAudit {
  return {
    title: "Acme — do the thing",
    docHeight: 6200,
    body: { backgroundColor: "rgb(13, 13, 18)", color: "rgb(250, 250, 250)", fontFamily: '"Inter", system-ui, sans-serif', fontSize: 16 },
    fonts: ['"Inter", system-ui, sans-serif', '"Berkeley Mono", ui-monospace, monospace'],
    weights: [400, 510, 590],
    headings: [
      { level: "h1", fontSize: 64, lineHeight: 67.2, fontWeight: 590, fontFamily: '"Inter Display", system-ui', letterSpacing: "-0.022em", textTransform: "none" },
      { level: "h2", fontSize: 40, lineHeight: 44, fontWeight: 590, fontFamily: '"Inter Display", system-ui', letterSpacing: "-0.022em", textTransform: "none" },
    ],
    bodySample: { fontSize: 16, lineHeight: 24, fontWeight: 400, fontFamily: '"Inter", system-ui', letterSpacing: "normal", textTransform: "none" },
    navSample: { fontSize: 13, lineHeight: 16, fontWeight: 510, fontFamily: '"Inter", system-ui', letterSpacing: "normal", textTransform: "none" },
    buttons: [
      { selector: "body > main > a:nth-of-type(1)", backgroundColor: "rgb(94, 106, 210)", color: "rgb(255, 255, 255)", borderRadius: "8px", borderColor: "rgba(0, 0, 0, 0)", boxShadow: "none", fontSize: 14, area: 5200, top: 480 },
      { selector: "body > footer > a", backgroundColor: "rgb(13, 13, 18)", color: "rgb(250, 250, 250)", borderRadius: "8px", borderColor: "rgb(60, 60, 70)", boxShadow: "none", fontSize: 14, area: 4100, top: 5900 },
    ],
    bgAreas: [
      { color: "rgb(13, 13, 18)", area: 4_000_000 },
      { color: "rgb(24, 24, 32)", area: 900_000 },
      { color: "rgb(34, 34, 44)", area: 300_000 },
    ],
    borderColors: [{ color: "rgb(46, 46, 56)", count: 38 }],
    radii: [
      { px: 8, kind: "button", count: 14 },
      { px: 16, kind: "card", count: 9 },
      { px: 30, kind: "media", count: 3 },
    ],
    shadows: [{ value: "rgba(0, 0, 0, 0.3) 0px 1px 2px 0px", count: 11 }],
    letterSpacings: [{ value: "-0.022em", context: "headings", count: 4 }],
    spacingSamples: [96, 128, 64, 24, 24, 32, 96, 8, 16],
    sections: [],
    navSelector: "body > header",
    navPosition: "sticky",
    scrollSnap: false,
    smoothScrollLib: null,
    hiddenCandidates: [],
    tabSelectors: [],
    hoverTargets: ["body > main > a:nth-of-type(1)"],
    ...overrides,
  };
}

function sectionFixture(overrides: Partial<AuditSection> = {}): AuditSection {
  return {
    label: "section-1",
    selector: "body > main > section:nth-of-type(1)",
    tag: "section",
    top: 800,
    height: 700,
    childCount: 6,
    display: "block",
    gridCols: 0,
    descendantGridCols: 0,
    position: "static",
    hasVideo: false,
    hasCanvas: false,
    imageCount: 0,
    linkCount: 2,
    buttonCount: 0,
    headingLevel: "h2",
    textDensity: 90,
    classHint: "",
    hasMarqueeHint: false,
    hasPricingHint: false,
    hasAccordionHint: false,
    centeredText: false,
    ...overrides,
  };
}

// ── Color math ──────────────────────────────────────────────────────────────────────────────

describe("oklch conversion", () => {
  it("parses legacy and modern rgb forms plus hex", () => {
    expect(parseCssColor("rgb(255, 0, 0)")).toEqual({ r: 255, g: 0, b: 0, alpha: 1 });
    expect(parseCssColor("rgba(10, 20, 30, 0.5)")).toEqual({ r: 10, g: 20, b: 30, alpha: 0.5 });
    expect(parseCssColor("rgb(10 20 30 / 80%)")).toEqual({ r: 10, g: 20, b: 30, alpha: 0.8 });
    expect(parseCssColor("#fff")).toEqual({ r: 255, g: 255, b: 255, alpha: 1 });
    expect(parseCssColor("blurple")).toBeNull();
  });

  it("converts white and black to the known oklch poles", () => {
    expect(cssColorToOklch("rgb(255, 255, 255)")).toBe("oklch(1 0 0)");
    expect(cssColorToOklch("rgb(0, 0, 0)")).toBe("oklch(0 0 0)");
  });

  it("converts a saturated color into a plausible oklch triple", () => {
    const result = cssColorToOklch("rgb(94, 106, 210)");
    expect(result).toMatch(/^oklch\(0\.5\d+ 0\.1\d+ 27\d(\.\d+)?\)$/);
  });

  it("passes through oklch and carries alpha", () => {
    expect(cssColorToOklch("oklch(0.5 0.1 200)")).toBe("oklch(0.5 0.1 200)");
    expect(cssColorToOklch("rgba(0, 0, 0, 0.5)")).toContain("/ 0.5");
  });

  it("flags transparency and ranks luminance", () => {
    expect(isTransparent("rgba(0, 0, 0, 0)")).toBe(true);
    expect(isTransparent("rgb(0, 0, 0)")).toBe(false);
    const dark = approxLuminance("rgb(13, 13, 18)");
    const light = approxLuminance("rgb(250, 250, 250)");
    expect(dark).not.toBeNull();
    expect(light).not.toBeNull();
    expect(light as number).toBeGreaterThan(dark as number);
  });
});

// ── Slugs ───────────────────────────────────────────────────────────────────────────────────

describe("sourceSlugFromUrl", () => {
  it("matches the SPEC examples", () => {
    expect(sourceSlugFromUrl("https://linear.app")).toBe("linear-app");
    expect(sourceSlugFromUrl("https://stripe.com/pricing")).toBe("stripe-com-pricing");
  });
  it("strips www and trailing slashes", () => {
    expect(sourceSlugFromUrl("https://www.linear.app/")).toBe("linear-app");
  });
  it("survives a non-URL string", () => {
    expect(sourceSlugFromUrl("not a url")).toBe("not-a-url");
  });
});

// ── Inference ───────────────────────────────────────────────────────────────────────────────

describe("buildPalette", () => {
  it("maps body colors to background/foreground and the top filled button to primary", () => {
    const palette = buildPalette(auditFixture());
    expect(palette.mode).toBe("dark");
    expect(palette.roles.background?.oklch).toBe(cssColorToOklch("rgb(13, 13, 18)"));
    expect(palette.roles.foreground?.oklch).toBe(cssColorToOklch("rgb(250, 250, 250)"));
    expect(palette.roles.primary?.oklch).toBe(cssColorToOklch("rgb(94, 106, 210)"));
    expect(palette.roles.border?.oklch).toBe(cssColorToOklch("rgb(46, 46, 56)"));
    expect(palette.roles.card).toBeDefined();
  });

  it("skips ghost buttons whose fill equals the page background", () => {
    const audit = auditFixture({
      buttons: [
        { selector: "a", backgroundColor: "rgb(13, 13, 18)", color: "rgb(250, 250, 250)", borderRadius: "8px", borderColor: "rgb(60, 60, 70)", boxShadow: "none", fontSize: 14, area: 4100, top: 100 },
      ],
    });
    const palette = buildPalette(audit);
    expect(palette.roles.primary).toBeUndefined();
  });

  it("omits roles it can't defend instead of guessing", () => {
    const audit = auditFixture({ bgAreas: [], borderColors: [], buttons: [] });
    const palette = buildPalette(audit);
    expect(palette.roles.card).toBeUndefined();
    expect(palette.roles.border).toBeUndefined();
  });
});

describe("buildTypography", () => {
  it("separates display from body families and keeps exact weights", () => {
    const typography = buildTypography(auditFixture());
    expect(typography.families.find((f) => f.role === "display")?.family).toBe("Inter Display");
    expect(typography.families.find((f) => f.role === "body")?.family).toBe("Inter");
    expect(typography.families.find((f) => f.role === "mono")?.family).toBe("Berkeley Mono");
    expect(typography.weights_used).toEqual([400, 510, 590]);
    expect(typography.scale[0]).toEqual({ px: 64, line_height: 67.2, usage: "hero headline (1440)" });
    expect(typography.scale.map((s) => s.px)).toEqual([64, 40, 16, 13]);
  });
});

describe("buildSpacing", () => {
  it("finds an 8px grid when most values divide by 8", () => {
    const spacing = buildSpacing([96, 128, 64, 24, 24, 32, 96, 8, 16]);
    expect(spacing.base_unit_px).toBe(8);
    expect(spacing.multipliers_used).toContain(12);
    expect(spacing.notes).toContain("64–128px");
  });
  it("reports no rhythm honestly", () => {
    const spacing = buildSpacing([7, 13, 22, 35, 51, 9]);
    expect(spacing.base_unit_px).toBeNull();
    expect(spacing.notes).toContain("No consistent grid");
  });
  it("declines to infer from too few samples", () => {
    expect(buildSpacing([8, 16]).base_unit_px).toBeNull();
  });
});

describe("buildRadius + buildShadows", () => {
  it("dedupes radii by px and labels by dominant context", () => {
    const radius = buildRadius(auditFixture().radii);
    expect(radius).toEqual([
      { px: 8, usage: "buttons, inputs, small chips" },
      { px: 16, usage: "cards, feature tiles" },
      { px: 30, usage: "screenshots / media frames" },
    ]);
  });
  it("drops one-off shadows", () => {
    expect(buildShadows([{ value: "0 1px 2px rgba(0,0,0,0.3)", count: 1 }])).toEqual([]);
  });
});

describe("classifyArchetype", () => {
  it("classifies a sticky nav", () => {
    const result = classifyArchetype(sectionFixture({ label: "nav", position: "sticky" }), { collapsesOnMobile: false });
    expect(result.archetype).toBe("sticky-blur-nav");
  });
  it("classifies a centered h1 hero", () => {
    const result = classifyArchetype(sectionFixture({ headingLevel: "h1", centeredText: true }), { collapsesOnMobile: false });
    expect(result.archetype).toBe("centered-stack");
  });
  it("classifies grids, pricing, marquees, accordions, and footers", () => {
    expect(classifyArchetype(sectionFixture({ descendantGridCols: 3 }), { collapsesOnMobile: true }).archetype).toBe("bento-grid");
    expect(classifyArchetype(sectionFixture({ hasPricingHint: true, gridCols: 3 }), { collapsesOnMobile: true }).archetype).toBe("pricing-columns");
    expect(classifyArchetype(sectionFixture({ hasMarqueeHint: true, imageCount: 8, textDensity: 10 }), { collapsesOnMobile: false }).archetype).toBe("logo-marquee");
    expect(classifyArchetype(sectionFixture({ hasAccordionHint: true }), { collapsesOnMobile: false }).archetype).toBe("accordion-stack");
    expect(classifyArchetype(sectionFixture({ label: "footer", tag: "footer", gridCols: 5 }), { collapsesOnMobile: true }).archetype).toBe("multi-column-footer");
  });
  it("falls back to honest generics", () => {
    expect(classifyArchetype(sectionFixture(), { collapsesOnMobile: false }).archetype).toBe("content-stack");
  });
});

describe("inferInteractionModel", () => {
  const behavior = (trigger_type: Behavior["trigger_type"]): Behavior => ({
    name: "x",
    trigger_type,
    trigger: "t",
    from: "a",
    to: "b",
    transition: "200ms",
    mechanism: "unknown",
  });
  it("reads static, single-type, and mixed pages", () => {
    expect(inferInteractionModel([], false)).toBe("static");
    expect(inferInteractionModel([behavior("scroll")], false)).toBe("scroll-driven");
    expect(inferInteractionModel([behavior("click")], false)).toBe("click-driven");
    expect(inferInteractionModel([behavior("scroll"), behavior("click")], false)).toBe("mixed");
    expect(inferInteractionModel([behavior("click")], true)).toBe("mixed");
  });
});

// ── State diff + log ────────────────────────────────────────────────────────────────────────

describe("diffSnapshots", () => {
  it("the diff IS the behavior spec — and transition churn is excluded", () => {
    const diffs = diffSnapshots(
      { backgroundColor: "rgba(0, 0, 0, 0)", transition: "all 0s" },
      { backgroundColor: "rgb(13, 13, 18)", backdropFilter: "blur(12px)", transition: "all 0.2s" },
    );
    expect(diffs).toContainEqual({ prop: "backgroundColor", from: "rgba(0, 0, 0, 0)", to: "rgb(13, 13, 18)" });
    expect(diffs).toContainEqual({ prop: "backdropFilter", from: "(unset)", to: "blur(12px)" });
    expect(diffs.find((d) => d.prop === "transition")).toBeUndefined();
  });
});

describe("renderExtractionLog", () => {
  it("renders every entry as a table row and escapes pipes", () => {
    const md = renderExtractionLog(
      [{ at: "2026-06-12T10:00:00.000Z", step: "hover|x", outcome: "failed", detail: "a|b" }],
      "https://linear.app",
    );
    expect(md).toContain("# Extraction log — https://linear.app");
    expect(md).toContain("hover\\|x");
    expect(md).toContain("a\\|b");
  });
});

// ── Serializer ──────────────────────────────────────────────────────────────────────────────

describe("serializeDesignDna", () => {
  it("emits the SPEC block shape with quoted complex scalars", () => {
    const yaml = serializeDesignDna(dnaFixture());
    expect(yaml.startsWith("design_dna:")).toBe(true);
    expect(yaml).toContain("  interaction_model: mixed");
    expect(yaml).toContain('      background: { oklch: "oklch(0.145 0.004 285.8)", source: computed }');
    expect(yaml).toContain('      - { role: body, family: Inter, fallbacks: [system-ui], source: unknown }');
    expect(yaml).toContain("    base_unit_px: 8");
    expect(yaml).toContain("    - name: nav-change-on-scroll");
    expect(yaml).toContain("      trigger_type: scroll");
    expect(yaml).toContain("    complete: false");
    expect(yaml).toContain("    bot_wall: false");
  });

  it("quotes scalars that would break YAML", () => {
    expect(yamlScalar("plain-word")).toBe("plain-word");
    expect(yamlScalar('say "hi": ok')).toBe('"say \\"hi\\": ok"');
    expect(yamlScalar(8)).toBe("8");
    expect(yamlScalar(null)).toBe("null");
  });
});

describe("serializeSourceMeta", () => {
  it("carries provenance + the screenshot manifest", () => {
    const source: SourceMeta = {
      url: "https://linear.app",
      final_url: "https://linear.app/",
      title: "Linear – Plan and build products",
      captured_at: "2026-06-12",
      viewports: [1440, 768, 390],
      extractor: "pa-extraction-worker/v1",
      capture_method: "headless",
      screenshots: ["screenshots/full-1440.jpg"],
    };
    const yaml = serializeSourceMeta(source);
    expect(yaml).toContain('  url: "https://linear.app"');
    expect(yaml).toContain("  viewports: [1440, 768, 390]");
    expect(yaml).toContain('    - "screenshots/full-1440.jpg"');
  });
});
