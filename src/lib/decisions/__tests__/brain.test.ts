import { describe, it, expect } from "vitest";
import {
  questionTokens,
  slugForQuestion,
  questionOverlap,
  setSupersededBy,
  buildVerdictMarkdown,
} from "../brain";
import type { RoundtableTurn } from "../types";

describe("question tokens + slug", () => {
  it("drops stopwords and keeps significant tokens", () => {
    const toks = questionTokens("Should I raise prices on Patrick?");
    expect(toks).toContain("raise");
    expect(toks).toContain("prices");
    expect(toks).toContain("patrick");
    expect(toks).not.toContain("should");
    expect(toks).not.toContain("on");
  });

  it("builds a kebab slug, capped", () => {
    expect(slugForQuestion("Should I raise prices on Patrick?")).toBe("raise-prices-patrick");
    expect(slugForQuestion("???")).toBe("decision");
  });
});

describe("questionOverlap", () => {
  it("is 1 for the same question and low for disjoint ones", () => {
    expect(questionOverlap("raise prices on Patrick", "raise prices on Patrick")).toBe(1);
    // Only the incidental "new" overlaps → well under the 0.5 precedent threshold.
    expect(questionOverlap("hire a new rep", "buy a new truck")).toBeLessThan(0.5);
  });

  it("crosses the precedent threshold for a clearly matching reword", () => {
    expect(questionOverlap("Should I raise prices on Patrick?", "Raise Patrick's prices?")).toBeGreaterThanOrEqual(0.5);
  });
});

describe("setSupersededBy", () => {
  it("updates an existing empty superseded_by line", () => {
    const prior = "---\nname: x\nsuperseded_by:\n---\nbody";
    expect(setSupersededBy(prior, "2026-06-09-new.md")).toContain("superseded_by: 2026-06-09-new.md");
  });

  it("inserts the field before the closing fence when absent", () => {
    const prior = "---\nname: x\ndate: 2026-01-01\n---\nbody";
    const out = setSupersededBy(prior, "new.md");
    expect(out).toContain("superseded_by: new.md");
    expect(out.indexOf("superseded_by")).toBeLessThan(out.lastIndexOf("---"));
  });
});

describe("buildVerdictMarkdown", () => {
  const turns: RoundtableTurn[] = [
    {
      id: "1", roundtable_id: "r", owner_id: "o", role: "steelman", model_backing: "pa_managed:claude-sonnet-4-6",
      round_index: 0, turn_index: 0, content: "Do it.", created_at: "t",
    },
  ];

  it("writes frontmatter, the verdict body, and a supersedes pointer", () => {
    const md = buildVerdictMarkdown(
      {
        question: "Should I raise prices on Patrick?",
        verdict: { recommendation: "raw", strongestDissent: "churn risk", supportingEvidence: "[memory/pricing.md]" },
        savedRecommendation: "Raise 8% on renewal.",
        decisionType: "pricing",
        stakesLevel: "high",
        rolesUsed: ["steelman", "moderator"],
        modelBackings: ["pa_managed:claude-sonnet-4-6"],
        turns,
      },
      "2026-05-01-raise-prices-patrick.md",
    );
    expect(md).toContain("type: decision");
    expect(md).toContain("decision_type: pricing");
    expect(md).toContain("stakes_level: high");
    expect(md).toContain("supersedes: 2026-05-01-raise-prices-patrick.md");
    expect(md).toContain("## Verdict");
    expect(md).toContain("Raise 8% on renewal.");
    expect(md).toContain("churn risk");
  });

  it("leaves supersedes blank when there is no prior decision", () => {
    const md = buildVerdictMarkdown(
      {
        question: "Hire a rep?",
        verdict: { recommendation: "r", strongestDissent: "", supportingEvidence: "" },
        savedRecommendation: "Yes.",
        decisionType: "hiring",
        stakesLevel: "medium",
        rolesUsed: ["steelman"],
        modelBackings: [],
        turns,
      },
      null,
    );
    expect(md).toContain("supersedes: \n");
  });
});
