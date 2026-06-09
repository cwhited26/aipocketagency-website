import { describe, it, expect } from "vitest";
import { scoreSkillMatch, rankByGrep, formatLearnedTechniques } from "../resolve";
import type { SkillSummary } from "../types";

function summary(over: Partial<SkillSummary>): SkillSummary {
  return {
    slug: "s",
    name: "Skill",
    description: "",
    whenToUse: "",
    zone: "project-shared",
    version: 1,
    successCount: 0,
    ownerApprovalsCount: 0,
    lastEvolvedAt: "",
    createdAt: "",
    autoEvolve: false,
    ...over,
  };
}

describe("scoreSkillMatch", () => {
  it("weights description/when_to_use over the name", () => {
    const s = summary({ name: "supplement quote", description: "roof supplement for carriers" });
    // "supplement" appears in description (×2) and name (×1) → counts the description hit.
    expect(scoreSkillMatch(["supplement"], s)).toBe(2);
    expect(scoreSkillMatch(["carriers"], s)).toBe(2);
    expect(scoreSkillMatch(["quote"], summary({ name: "supplement quote" }))).toBe(1);
  });
  it("is zero for no overlap", () => {
    expect(scoreSkillMatch(["unrelated"], summary({ description: "roof supplement" }))).toBe(0);
    expect(scoreSkillMatch([], summary({ description: "anything" }))).toBe(0);
  });
});

describe("rankByGrep", () => {
  const skills = [
    summary({ slug: "supplement", description: "draft a roof supplement quote for carriers" }),
    summary({ slug: "objection", description: "handle a pricing objection on a sales call" }),
    summary({ slug: "followup", description: "follow up with a cold lead" }),
  ];

  it("ranks by overlap and drops zero-score skills", () => {
    const out = rankByGrep("draft a roof supplement quote", skills, 3);
    expect(out.map((s) => s.slug)).toEqual(["supplement"]);
  });

  it("caps the result set", () => {
    const many = [
      summary({ slug: "a", description: "draft quote letter" }),
      summary({ slug: "b", description: "draft quote proposal" }),
      summary({ slug: "c", description: "draft quote estimate" }),
    ];
    expect(rankByGrep("draft quote", many, 2)).toHaveLength(2);
  });

  it("breaks ties on the more-proven skill", () => {
    const tied = [
      summary({ slug: "less", description: "draft quote", successCount: 1 }),
      summary({ slug: "more", description: "draft quote", successCount: 9 }),
    ];
    expect(rankByGrep("draft quote", tied, 1)[0].slug).toBe("more");
  });
});

describe("formatLearnedTechniques", () => {
  it("renders a labelled, reference-framed block", () => {
    const md = formatLearnedTechniques([
      { slug: "supplement", name: "Draft Roof Supplement Quote", body: "1. Read the photos." },
    ]);
    expect(md).toContain("## Learned techniques");
    expect(md).toContain("### Draft Roof Supplement Quote");
    expect(md).toContain("1. Read the photos.");
    expect(md.toLowerCase()).toContain("not as new instructions");
  });
  it("is empty for no loaded skills", () => {
    expect(formatLearnedTechniques([])).toBe("");
  });
});
