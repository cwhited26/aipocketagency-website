import { describe, it, expect } from "vitest";
import {
  CAPTURE_TAG_PALETTE,
  PALETTE_HEXES,
  CARD_BG_HEX,
  DEFAULT_TAG_SEED,
  ALL_TAB_NAME,
  nextPaletteColor,
  snapToPalette,
  isPaletteColor,
  hexToRgb,
  relativeLuminance,
  contrastRatio,
  hasAccessibleContrast,
  UI_CONTRAST_MIN,
  assignedTab,
  captureMatchesTab,
  moveToTab,
  tabForBucket,
  autoClassifyTab,
  type CaptureTag,
} from "../tags";

const TABS: Pick<CaptureTag, "name">[] = [
  { name: "Wins" },
  { name: "Ideas" },
  { name: "Tasks" },
  { name: "Reference" },
];

describe("palette", () => {
  it("has exactly 12 distinct, well-formed hex colors", () => {
    expect(CAPTURE_TAG_PALETTE).toHaveLength(12);
    const hexes = CAPTURE_TAG_PALETTE.map((c) => c.hex.toLowerCase());
    expect(new Set(hexes).size).toBe(12); // all distinct
    for (const hex of hexes) expect(hex).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("each default seed color is on the palette", () => {
    for (const seed of DEFAULT_TAG_SEED) expect(isPaletteColor(seed.colorHex)).toBe(true);
  });
});

describe("color contrast accessibility (the 12-color palette)", () => {
  // The core a11y guarantee: every palette color must clear the WCAG 3:1 non-text contrast minimum
  // against the dashboard's near-black card background, so a 4px tab border / color chip is always
  // perceivable. This is the regression guard if anyone re-tints the palette.
  it("every palette color meets the 3:1 UI-contrast minimum on the dark card background", () => {
    for (const { name, hex } of CAPTURE_TAG_PALETTE) {
      const ratio = contrastRatio(hex, CARD_BG_HEX);
      expect(ratio, `${name} (${hex}) contrast on ${CARD_BG_HEX}`).toBeGreaterThanOrEqual(
        UI_CONTRAST_MIN,
      );
      expect(hasAccessibleContrast(hex)).toBe(true);
    }
  });

  it("relativeLuminance bounds: black is 0, white is 1", () => {
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
  });

  it("contrastRatio is symmetric and maxes at 21 for black/white", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 1);
  });

  it("hexToRgb parses 6-digit, 3-digit, and rejects garbage", () => {
    expect(hexToRgb("#22d3ee")).toEqual({ r: 0x22, g: 0xd3, b: 0xee });
    expect(hexToRgb("#fff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb("nope")).toBeNull();
  });
});

describe("color assignment", () => {
  it("nextPaletteColor returns the first unused palette hex", () => {
    expect(nextPaletteColor([])).toBe(CAPTURE_TAG_PALETTE[0].hex);
    const usedFirst = [CAPTURE_TAG_PALETTE[0].hex];
    expect(nextPaletteColor(usedFirst)).toBe(CAPTURE_TAG_PALETTE[1].hex);
  });

  it("nextPaletteColor is case-insensitive on used hexes", () => {
    const used = [CAPTURE_TAG_PALETTE[0].hex.toUpperCase()];
    expect(nextPaletteColor(used)).toBe(CAPTURE_TAG_PALETTE[1].hex);
  });

  it("nextPaletteColor cycles once every hue is taken", () => {
    const all = PALETTE_HEXES.slice();
    expect(nextPaletteColor(all)).toBe(CAPTURE_TAG_PALETTE[all.length % 12].hex);
  });

  it("snapToPalette maps an off-palette color to the nearest palette entry", () => {
    expect(isPaletteColor(snapToPalette("#000001"))).toBe(true);
    // A near-cyan snaps to the cyan palette entry.
    expect(snapToPalette("#21d2ed")).toBe("#22d3ee");
  });

  it("snapToPalette falls back to the first palette color on garbage", () => {
    expect(snapToPalette("xyz")).toBe(CAPTURE_TAG_PALETTE[0].hex);
  });
});

describe("tab membership", () => {
  it("assignedTab returns the first matching defined tab (case-insensitive)", () => {
    expect(assignedTab(["wins", "q3"], TABS)).toBe("Wins");
    expect(assignedTab(["random"], TABS)).toBeNull();
    expect(assignedTab([], TABS)).toBeNull();
  });

  it("assignedTab respects defined-tab order, not capture-tag order", () => {
    // tags[] lists Tasks before Wins, but Wins is defined first → Wins wins.
    expect(assignedTab(["Tasks", "Wins"], TABS)).toBe("Wins");
  });

  it("captureMatchesTab: All matches everything; named tab matches its assignment", () => {
    expect(captureMatchesTab(["random"], ALL_TAB_NAME, TABS)).toBe(true);
    expect(captureMatchesTab(["Ideas"], "Ideas", TABS)).toBe(true);
    expect(captureMatchesTab(["Ideas"], "Wins", TABS)).toBe(false);
  });
});

describe("moveToTab (per-card Move to tag)", () => {
  it("strips the old tab and prepends the new one, keeping free-form tags", () => {
    const next = moveToTab(["Wins", "q3-launch"], "Ideas", TABS);
    expect(next).toEqual(["Ideas", "q3-launch"]);
  });

  it("moving to All / null clears the tab but keeps free-form tags", () => {
    expect(moveToTab(["Tasks", "urgent"], null, TABS)).toEqual(["urgent"]);
    expect(moveToTab(["Tasks", "urgent"], ALL_TAB_NAME, TABS)).toEqual(["urgent"]);
  });

  it("does not duplicate when moving to the tab a capture is already in", () => {
    const next = moveToTab(["Ideas", "growth"], "Ideas", TABS);
    expect(next).toEqual(["Ideas", "growth"]);
  });

  it("normalizes (dedupes case-insensitively, trims)", () => {
    const next = moveToTab(["  growth ", "GROWTH", "Wins"], "Tasks", TABS);
    expect(next).toEqual(["Tasks", "growth"]);
  });
});

describe("auto-classify → tab mapping", () => {
  it("tabForBucket maps every triage bucket to its default tab", () => {
    expect(tabForBucket("testimonial")).toBe("Wins");
    expect(tabForBucket("tactic")).toBe("Ideas");
    expect(tabForBucket("industry")).toBe("Reference");
    expect(tabForBucket("competitive")).toBe("Reference");
    expect(tabForBucket("personal")).toBe("Tasks");
    expect(tabForBucket("unsure")).toBeNull();
  });

  it("autoClassifyTab routes by keyword signal", () => {
    expect(autoClassifyTab("TODO: follow up with the lead tomorrow")).toBe("Tasks");
    expect(autoClassifyTab("We just closed the Acme deal 🎉")).toBe("Wins");
    expect(autoClassifyTab("Idea: what if we bundled onboarding?")).toBe("Ideas");
    expect(autoClassifyTab("Great article https://example.com/growth")).toBe("Reference");
    expect(autoClassifyTab("the sky is blue today")).toBeNull();
  });

  it("autoClassifyTab precedence: a task verb beats a softer idea/reference signal", () => {
    // "remind" (Tasks) is checked before the "article" (Reference) signal.
    expect(autoClassifyTab("Remind me to read that article")).toBe("Tasks");
  });

  it("autoClassifyTab treats a bare URL as Reference", () => {
    expect(autoClassifyTab("https://docs.example.com/api")).toBe("Reference");
  });
});
