// fixtures.ts — shared test fixtures for the extraction + inspector suites (not a test file,
// so importing it never re-runs another suite).

import type { DesignDna } from "../types";

export function dnaFixture(): DesignDna {
  return {
    interaction_model: "mixed",
    palette: {
      roles: {
        background: { oklch: "oklch(0.145 0.004 285.8)", source: "computed" },
        primary: { oklch: "oklch(0.623 0.188 275.4)", source: "computed" },
      },
      extras: [],
      mode: "dark",
    },
    typography: {
      families: [{ role: "body", family: "Inter", fallbacks: ["system-ui"], source: "unknown" }],
      weights_used: [400, 510],
      scale: [{ px: 64, line_height: 67.2, usage: "hero headline (1440)" }],
      letter_spacing: [{ value: "-0.022em", usage: "headings" }],
    },
    spacing: { base_unit_px: 8, multipliers_used: [1, 2, 4], notes: "Section padding 96-128px." },
    radius: [{ px: 8, usage: "buttons, inputs, small chips" }],
    shadows: [{ value: "0 1px 2px rgba(0,0,0,0.3)", usage: "common low elevation" }],
    layout: [
      { section: "nav", archetype: "sticky-blur-nav", notes: "pinned while scrolling" },
      { section: "section-1", archetype: "bento-grid" },
    ],
    behaviors: [
      {
        name: "nav-change-on-scroll",
        trigger_type: "scroll",
        trigger: "scrollY > ~480px",
        from: "backgroundColor: rgba(0, 0, 0, 0)",
        to: "backgroundColor: rgb(13, 13, 18)",
        transition: "all 0.2s ease",
        mechanism: "scroll-listener",
      },
    ],
    coverage: {
      complete: false,
      missed: ["Hover states on footer links skipped"],
      bot_wall: false,
      notes: "Unattended run.",
    },
  };
}
