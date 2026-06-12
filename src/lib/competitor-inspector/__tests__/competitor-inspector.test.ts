// competitor-inspector.test.ts — the profile wrapper, the no-copy guarantee on the model input,
// the structural fallback, payload guards, and the tier gate.

import { describe, expect, it } from "vitest";
import { buildCompetitorProfileMd, profileTags } from "../profile";
import { structuralFallbackProse } from "../summary";
import {
  commitProfilePayloadOf,
  extractionLogPathFor,
  profilePathFor,
  screenshotPathFor,
} from "../types";
import { tierAllowsCompetitorInspector } from "@/lib/personas/tier-caps";
import { dnaFixture } from "@/lib/url-extraction/__tests__/fixtures";
import type { SourceMeta } from "@/lib/url-extraction/types";

const sourceFixture: SourceMeta = {
  url: "https://linear.app",
  final_url: "https://linear.app/",
  title: "Linear – Plan and build products",
  captured_at: "2026-06-12",
  viewports: [1440, 768, 390],
  extractor: "pa-extraction-worker/v1",
  capture_method: "headless",
  screenshots: ["screenshots/full-1440.jpg", "screenshots/full-390.jpg"],
};

describe("paths", () => {
  it("builds the brain paths off the source slug", () => {
    expect(profilePathFor("linear-app")).toBe("competitors/linear-app/profile.md");
    expect(extractionLogPathFor("linear-app")).toBe("competitors/linear-app/extraction-log.md");
    expect(screenshotPathFor("linear-app", "full-1440.jpg")).toBe(
      "competitors/linear-app/screenshots/full-1440.jpg",
    );
  });
});

describe("commitProfilePayloadOf", () => {
  it("accepts a complete payload and rejects partial ones", () => {
    const full = {
      extraction_id: "x",
      profile_path: "competitors/linear-app/profile.md",
      log_path: "competitors/linear-app/extraction-log.md",
      source_url: "https://linear.app/",
    };
    expect(commitProfilePayloadOf(full)).toEqual(full);
    expect(commitProfilePayloadOf({ extraction_id: "x" })).toBeNull();
    expect(commitProfilePayloadOf({ ...full, extraction_id: 42 })).toBeNull();
  });
});

describe("buildCompetitorProfileMd", () => {
  const prose = {
    offer_summary: "Appears to sell project software, judged from the pricing columns.",
    look_paragraph: "Dark canvas, one violet accent, restrained motion.",
    distinctive: ["30px media frames against 8px buttons", "Variable weights 510/590"],
    borrow_skip: "Borrow the spacing discipline. Skip the bento grid.",
  };

  it("wraps the SPEC §7.3 shape: wrapper fields + the embedded design_dna block + prose body", () => {
    const md = buildCompetitorProfileMd({
      sourceSlug: "linear-app",
      dna: dnaFixture(),
      source: sourceFixture,
      ownerNote: "They keep beating us on design",
      prose,
    });
    expect(md.startsWith("---\nrecord: competitor-profile\nschema_version: 1\n")).toBe(true);
    expect(md).toContain("slug: linear-app");
    expect(md).toContain('owner_note: "They keep beating us on design"');
    expect(md).toContain("watch_state: one_off");
    expect(md).toContain("design_dna:");
    expect(md).toContain("  interaction_model: mixed");
    expect(md).toContain("# linear.app — captured June 12, 2026");
    expect(md).toContain("## What they appear to sell");
    expect(md).toContain("## What to borrow / what to skip");
    expect(md).toContain("## Coverage notes");
    expect(md).toContain("extraction-log.md");
  });

  it("omits owner_note when none was given", () => {
    const md = buildCompetitorProfileMd({
      sourceSlug: "linear-app",
      dna: dnaFixture(),
      source: sourceFixture,
      ownerNote: null,
      prose,
    });
    expect(md).not.toContain("owner_note:");
  });

  it("carries no copy and no asset fields — only style data", () => {
    const md = buildCompetitorProfileMd({
      sourceSlug: "linear-app",
      dna: dnaFixture(),
      source: sourceFixture,
      ownerNote: null,
      prose,
    });
    // The record's only URLs are the captured source itself; no image srcs, no font files.
    expect(md).not.toMatch(/\.(png|webp|woff2?|svg)["')\s]/);
    expect(md).not.toContain("text_content");
  });

  it("derives tags from mode, interaction model, and distinctive archetypes", () => {
    expect(profileTags(dnaFixture())).toEqual(["dark", "mixed", "sticky-blur-nav", "bento-grid"]);
  });
});

describe("structuralFallbackProse", () => {
  it("reads the offer from structure and says the model didn't run", () => {
    const prose = structuralFallbackProse(dnaFixture(), "no model key connected");
    expect(prose.offer_summary).toContain("Structural read only (no model key connected)");
    expect(prose.offer_summary).toContain("feature grid");
    expect(prose.look_paragraph).toContain("Dark canvas");
    expect(prose.borrow_skip).toContain("No model read ran");
  });
});

describe("tierAllowsCompetitorInspector", () => {
  it("gates at Pro+ and above", () => {
    expect(tierAllowsCompetitorInspector("starter")).toBe(false);
    expect(tierAllowsCompetitorInspector("pro")).toBe(false);
    expect(tierAllowsCompetitorInspector("pro_plus")).toBe(true);
    expect(tierAllowsCompetitorInspector("studio")).toBe(true);
    expect(tierAllowsCompetitorInspector("studio_plus")).toBe(true);
    expect(tierAllowsCompetitorInspector("enterprise")).toBe(true);
  });
});
