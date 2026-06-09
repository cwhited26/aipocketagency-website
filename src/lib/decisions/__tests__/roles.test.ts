import { describe, it, expect } from "vitest";
import {
  buildArgSystemPrompt,
  buildArgUserPrompt,
  buildModeratorSystemPrompt,
  parseVerdict,
  transcriptLine,
  VERDICT_HEADERS,
} from "../roles";

describe("arg prompts", () => {
  it("demands the case FOR for the Steel-man and AGAINST for the Devil's Advocate", () => {
    expect(buildArgSystemPrompt("steelman")).toContain("FOR");
    expect(buildArgSystemPrompt("devils_advocate")).toContain("AGAINST");
  });

  it("names the vertical only for the Domain Specialist", () => {
    expect(buildArgSystemPrompt("domain_specialist", "roofing")).toContain("roofing");
    expect(buildArgSystemPrompt("steelman", "roofing")).not.toContain("matched vertical");
  });

  it("highlights an owner interjection in the user turn", () => {
    const prompt = buildArgUserPrompt({
      question: "Raise prices?",
      brainContext: "memory/pricing.md",
      transcript: "",
      interjection: "Patrick is price sensitive",
      vertical: null,
    });
    expect(prompt).toContain("OWNER JUST INTERJECTED");
    expect(prompt).toContain("Patrick is price sensitive");
  });

  it("flags the opening round when there's no transcript", () => {
    const prompt = buildArgUserPrompt({
      question: "Raise prices?",
      brainContext: "ctx",
      transcript: "",
      interjection: null,
    });
    expect(prompt.toLowerCase()).toContain("opening round");
  });
});

describe("moderator verdict", () => {
  it("prompts for exactly the three parseable sections", () => {
    const sys = buildModeratorSystemPrompt();
    expect(sys).toContain(VERDICT_HEADERS.recommendation);
    expect(sys).toContain(VERDICT_HEADERS.dissent);
    expect(sys).toContain(VERDICT_HEADERS.evidence);
  });

  it("parses a well-formed three-section verdict", () => {
    const text = [
      "RECOMMENDATION:",
      "Raise the rate 8% on renewal.",
      "",
      "STRONGEST DISSENT:",
      "Patrick may churn — he's price sensitive.",
      "",
      "SUPPORTING EVIDENCE:",
      "Margins are thin [memory/pricing.md].",
    ].join("\n");
    const v = parseVerdict(text);
    expect(v.recommendation).toBe("Raise the rate 8% on renewal.");
    expect(v.strongestDissent).toContain("price sensitive");
    expect(v.supportingEvidence).toContain("memory/pricing.md");
  });

  it("falls back to the whole text as the recommendation when unformatted", () => {
    const v = parseVerdict("Just do it, the upside is clear.");
    expect(v.recommendation).toBe("Just do it, the upside is clear.");
    expect(v.strongestDissent).toBe("");
  });
});

describe("transcriptLine", () => {
  it("tags an agent turn with its round but not an owner interjection", () => {
    expect(transcriptLine("steelman", 1, "x")).toContain("round 2");
    expect(transcriptLine("owner_interjection", 1, "x")).not.toContain("round");
  });
});
