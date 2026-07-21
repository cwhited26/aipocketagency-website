// voice.test.ts — the shared voice scanner (SPEC §11, chase-spec §10 kill list).

import { describe, it, expect } from "vitest";
import { scanVoiceViolations, hasVoiceViolations, summarizeViolations } from "../voice";

describe("scanVoiceViolations", () => {
  it("passes clean, operator-voice copy", () => {
    const clean =
      "Saw you just moved to lead RevOps at Northwind. We build the outbound tooling your team runs on. Worth a quick chat?";
    expect(scanVoiceViolations(clean)).toHaveLength(0);
    expect(hasVoiceViolations(clean)).toBe(false);
  });

  it("flags corporate + hype tells", () => {
    const slop =
      "Let's leverage our world-class platform to unlock synergies and empower your team with a game-changing solution.";
    const hits = scanVoiceViolations(slop);
    const rules = hits.map((h) => h.rule);
    expect(rules).toContain("corporate:leverage");
    expect(rules).toContain("hype:unlock");
    expect(rules).toContain("corporate:synergy");
    expect(hasVoiceViolations(slop)).toBe(true);
  });

  it("flags email-padding + guru + filler phrases", () => {
    expect(hasVoiceViolations("I hope this finds you well, just checking in.")).toBe(true);
    expect(hasVoiceViolations("Excited to share — let's dive in!")).toBe(true);
    expect(hasVoiceViolations("This is genuinely a straightforward win.")).toBe(true);
  });

  it("summarizes violations into a deduped voice_warning string", () => {
    const s = summarizeViolations(scanVoiceViolations("leverage leverage unlock"));
    expect(s).toMatch(/^voice_warning:/);
    // 'leverage' appears once despite two occurrences.
    expect(s.match(/leverage/gi)?.length).toBe(1);
  });

  it("returns an empty summary for clean text", () => {
    expect(summarizeViolations([])).toBe("");
  });
});
