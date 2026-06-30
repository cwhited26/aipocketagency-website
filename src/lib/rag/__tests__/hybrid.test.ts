// hybrid.test.ts — the hybrid re-ranker (PA-CTX-2). Pure functions, no I/O.

import { describe, expect, it } from "vitest";
import {
  blendHybridScores,
  jaccardOverlap,
  KEYWORD_WEIGHT,
  normalize,
  tokenize,
  VECTOR_WEIGHT,
} from "@/lib/rag/hybrid";
import type { RagHit } from "@/lib/rag/types";

describe("tokenize", () => {
  it("lowercases, splits on non-alphanumerics, drops single chars", () => {
    expect(tokenize("Refund Policy: a 30-day window!")).toEqual([
      "refund",
      "policy",
      "30",
      "day",
      "window",
    ]);
  });
  it("returns [] for empty / punctuation-only input", () => {
    expect(tokenize("   ")).toEqual([]);
    expect(tokenize("!!! …")).toEqual([]);
  });
});

describe("jaccardOverlap", () => {
  it("is |A∩B| / |A∪B|", () => {
    // A={a,b,c}, B={b,c,d} → inter 2, union 4 → 0.5
    expect(jaccardOverlap(["a", "b", "c"], ["b", "c", "d"])).toBeCloseTo(0.5, 6);
  });
  it("is 1 for identical sets and 0 for disjoint / empty", () => {
    expect(jaccardOverlap(["x", "y"], ["y", "x"])).toBe(1);
    expect(jaccardOverlap(["x"], ["y"])).toBe(0);
    expect(jaccardOverlap([], ["y"])).toBe(0);
  });
});

describe("normalize", () => {
  it("min-max maps to [0,1]", () => {
    expect(normalize([0, 5, 10])).toEqual([0, 0.5, 1]);
  });
  it("maps a flat list to all-1 (neutral signal)", () => {
    expect(normalize([3, 3, 3])).toEqual([1, 1, 1]);
  });
  it("returns [] for empty", () => {
    expect(normalize([])).toEqual([]);
  });
});

describe("blendHybridScores", () => {
  const hits: RagHit[] = [
    { docPath: "memory/a.md", score: 0.9, snippet: "general onboarding overview" },
    { docPath: "memory/b.md", score: 0.5, snippet: "refund policy thirty day window money back" },
    { docPath: "memory/c.md", score: 0.1, snippet: "office holiday schedule" },
  ];

  it("returns 0.7·vector + 0.3·keyword on normalized components", () => {
    const ranked = blendHybridScores("refund policy window", hits);
    const b = ranked.find((h) => h.docPath === "memory/b.md");
    if (!b) throw new Error("missing hit b");
    // b has the lowest-but-one vector score yet the only keyword overlap → keyword component normalizes
    // to 1, and its blended score must equal 0.7·vectorComponent + 0.3·1.
    expect(b.hybridScore).toBeCloseTo(VECTOR_WEIGHT * b.vectorComponent + KEYWORD_WEIGHT * b.keywordComponent, 6);
    expect(b.keywordComponent).toBe(1);
  });

  it("promotes a strong keyword match above a marginally-higher pure-vector hit", () => {
    // a edges b on vector (.62 vs .58) but has zero query-term overlap; b overlaps strongly. The 30%
    // keyword weight should lift b above a.
    const close: RagHit[] = [
      { docPath: "memory/a.md", score: 0.62, snippet: "general onboarding overview" },
      { docPath: "memory/b.md", score: 0.58, snippet: "refund policy thirty day window money back" },
      { docPath: "memory/c.md", score: 0.1, snippet: "office holiday schedule" },
    ];
    const ranked = blendHybridScores("refund policy money back window", close);
    const order = ranked.map((h) => h.docPath);
    expect(order.indexOf("memory/b.md")).toBeLessThan(order.indexOf("memory/a.md"));
  });

  it("falls back to pure vector order when no query term overlaps any snippet", () => {
    const ranked = blendHybridScores("zzzzz qqqqq", hits);
    // No overlap anywhere → keyword components all normalize to 1 (flat) → order tracks vector score.
    expect(ranked.map((h) => h.docPath)).toEqual(["memory/a.md", "memory/b.md", "memory/c.md"]);
  });

  it("is stable on ties and preserves the hit contract fields", () => {
    const flat: RagHit[] = [
      { docPath: "x", score: 1, snippet: "same" },
      { docPath: "y", score: 1, snippet: "same" },
    ];
    const ranked = blendHybridScores("nomatch", flat);
    expect(ranked.map((h) => h.docPath)).toEqual(["x", "y"]);
    expect(ranked[0]).toMatchObject({ docPath: "x", score: 1, snippet: "same" });
  });

  it("returns [] for no hits", () => {
    expect(blendHybridScores("anything", [])).toEqual([]);
  });
});
