import { describe, it, expect } from "vitest";
import {
  answerForStep,
  encodeAnswers,
  FUNNEL_FLOW,
  isFunnelSlug,
  isReassuranceSlug,
  nextSlug,
  parseAnswers,
  personaForAnswers,
  QUIZ_STEPS,
  reassuranceContent,
  setAnswer,
  tierCardFor,
  tierFromAnswers,
  TIER_CARDS,
} from "../quiz";

describe("quiz state parsing (URL-only state)", () => {
  it("round-trips a valid answers string", () => {
    expect(encodeAnswers(parseAnswers("0.2.1"))).toBe("0.2.1");
    expect(parseAnswers("0.2.1")).toEqual([0, 2, 1]);
  });

  it("returns [] for empty / missing input", () => {
    expect(parseAnswers("")).toEqual([]);
    expect(parseAnswers(null)).toEqual([]);
    expect(parseAnswers(undefined)).toEqual([]);
  });

  it("rejects malformed, negative, over-range, or over-long input", () => {
    expect(parseAnswers("a.b.c")).toEqual([]);
    expect(parseAnswers("-1.2")).toEqual([]);
    expect(parseAnswers("9.0")).toEqual([]); // option index >= MAX_OPTIONS
    expect(parseAnswers("0.0.0.0.0.0")).toEqual([]); // more than 5 answers
  });

  it("encodeAnswers drops invalid arrays", () => {
    expect(encodeAnswers([0, 1, 2])).toBe("0.1.2");
    expect(encodeAnswers([-1])).toBe("");
    expect(encodeAnswers([0, 1, 2, 3, 4, 5])).toBe(""); // too long
  });

  it("setAnswer is immutable and fills gaps densely", () => {
    const a = parseAnswers("0.1");
    const b = setAnswer(a, 4, 2); // jump to step 5 (index 4)
    expect(a).toEqual([0, 1]); // original untouched
    expect(b[4]).toBe(2);
    // gaps (index 2,3) are filled with 0 so the array stays encodable
    expect(encodeAnswers(b)).toBe("0.1.0.0.2");
  });

  it("answerForStep reads a slot or null", () => {
    const a = parseAnswers("3.0");
    expect(answerForStep(a, 0)).toBe(3);
    expect(answerForStep(a, 4)).toBeNull();
  });
});

describe("funnel flow machine", () => {
  it("threads questions and reassurances in order", () => {
    expect([...FUNNEL_FLOW]).toEqual(["1", "r1", "2", "3", "r2", "4", "5"]);
    expect(nextSlug("1")).toBe("r1");
    expect(nextSlug("r1")).toBe("2");
    expect(nextSlug("3")).toBe("r2");
    expect(nextSlug("r2")).toBe("4");
    expect(nextSlug("5")).toBeNull(); // last → caller routes to /start
  });

  it("guards unknown slugs", () => {
    expect(nextSlug("nope")).toBeNull();
    expect(isFunnelSlug("1")).toBe(true);
    expect(isFunnelSlug("r2")).toBe(true);
    expect(isFunnelSlug("99")).toBe(false);
    expect(isReassuranceSlug("r1")).toBe(true);
    expect(isReassuranceSlug("2")).toBe(false);
  });

  it("has exactly five numbered questions, one with tiers", () => {
    expect(QUIZ_STEPS).toHaveLength(5);
    const tiered = QUIZ_STEPS[4].options.filter((o) => o.tier);
    expect(tiered).toHaveLength(3);
  });
});

describe("tier-matching logic", () => {
  it("matches the tier from Step 5 when present", () => {
    expect(tierFromAnswers([0, 0, 0, 0, 0])).toBe("starter");
    expect(tierFromAnswers([0, 0, 0, 0, 1])).toBe("pro");
    expect(tierFromAnswers([0, 0, 0, 0, 2])).toBe("studio_plus");
  });

  it("falls back to Step 4 (team size) when Step 5 is missing", () => {
    expect(tierFromAnswers([0, 0, 0, 0])).toBe("starter"); // just me
    expect(tierFromAnswers([0, 0, 0, 1])).toBe("pro"); // 1-2 helpers
    expect(tierFromAnswers([0, 0, 0, 2])).toBe("studio_plus"); // team 5-10
    expect(tierFromAnswers([0, 0, 0, 3])).toBe("studio_plus"); // agency
  });

  it("defaults to the popular middle when there's nothing to match", () => {
    expect(tierFromAnswers([])).toBe("pro");
  });

  it("every matched tier resolves to a card", () => {
    for (const card of TIER_CARDS) {
      expect(tierCardFor(card.tier).tier).toBe(card.tier);
      expect(card.anchorUsd).toBeGreaterThan(card.monthlyUsd);
    }
  });
});

describe("persona + reassurance copy", () => {
  it("maps Step 1 to a Persona phrase", () => {
    expect(personaForAnswers([0])).toBe("an Admin Assistant");
    expect(personaForAnswers([1])).toBe("a Sales Assistant");
    expect(personaForAnswers([2])).toBe("a Content Creator");
    expect(personaForAnswers([3])).toBe("a Chief of Staff");
    expect(personaForAnswers([])).toBe("a Sales Assistant"); // default
  });

  it("tailors r1 to Step 1 and r2 to Step 3, with safe fallbacks", () => {
    expect(reassuranceContent("r1", [2]).eyebrow).toMatch(/Content Creator/);
    expect(reassuranceContent("r2", [0, 0, 0]).eyebrow).toBe("This week");
    // out-of-range answers fall back instead of throwing
    expect(reassuranceContent("r1", []).headline.length).toBeGreaterThan(0);
    expect(reassuranceContent("r2", []).headline.length).toBeGreaterThan(0);
  });
});
