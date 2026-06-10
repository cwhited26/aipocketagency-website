import { describe, it, expect } from "vitest";
import {
  tierRank,
  compareForCascade,
  rankMemories,
  selectWithinBudget,
  buildMemoryBlock,
  estimateTokens,
} from "../cascade";
import type { PersonaMemoryRow } from "../types";

function row(p: Partial<PersonaMemoryRow>): PersonaMemoryRow {
  return {
    id: p.id ?? "m",
    owner_id: p.owner_id ?? "owner",
    persona_id: p.persona_id ?? "pa",
    partition: p.partition ?? "semantic",
    tier: p.tier ?? "persona",
    conversation_id: p.conversation_id ?? null,
    body: p.body ?? "a memory",
    importance: p.importance ?? 5,
    contact_ref: p.contact_ref ?? null,
    untrusted_origin: p.untrusted_origin ?? false,
    source_event_id: null,
    superseded_by: null,
    created_at: p.created_at ?? "2026-06-01T00:00:00Z",
    last_read_at: null,
  };
}

describe("cascade ranking (SPEC §7.4)", () => {
  it("ranks global over persona over session", () => {
    expect(tierRank("global")).toBeGreaterThan(tierRank("persona"));
    expect(tierRank("persona")).toBeGreaterThan(tierRank("session"));
  });

  it("importance is primary — a high-importance session memory outranks a low-importance global one", () => {
    const sessionHigh = row({ id: "s", tier: "session", importance: 10 });
    const globalLow = row({ id: "g", tier: "global", importance: 4 });
    const ranked = rankMemories([globalLow, sessionHigh]);
    expect(ranked[0].id).toBe("s");
  });

  it("on an importance tie, global outranks persona", () => {
    const g = row({ id: "g", tier: "global", importance: 6 });
    const p = row({ id: "p", tier: "persona", importance: 6 });
    const ranked = rankMemories([p, g]);
    expect(ranked.map((r) => r.id)).toEqual(["g", "p"]);
  });

  it("at the same importance and tier, recent outranks old", () => {
    const old = row({ id: "old", created_at: "2026-01-01T00:00:00Z" });
    const recent = row({ id: "recent", created_at: "2026-06-09T00:00:00Z" });
    const ranked = rankMemories([old, recent]);
    expect(ranked.map((r) => r.id)).toEqual(["recent", "old"]);
  });

  it("does not mutate the input array", () => {
    const input = [row({ id: "a", importance: 1 }), row({ id: "b", importance: 9 })];
    const snapshot = input.map((r) => r.id);
    rankMemories(input);
    expect(input.map((r) => r.id)).toEqual(snapshot);
  });
});

describe("token budget (SPEC §7.5)", () => {
  it("keeps the highest-ranked memory and drops the marginal one when the budget is tight", () => {
    const big = "x".repeat(400); // ~100 tokens
    const ranked = [row({ id: "keep", importance: 10, body: big }), row({ id: "drop", importance: 1, body: big })];
    const selected = selectWithinBudget(ranked, 120);
    expect(selected.map((r) => r.id)).toEqual(["keep"]);
  });

  it("includes everything when the budget is ample", () => {
    const ranked = [row({ id: "a" }), row({ id: "b" }), row({ id: "c" })];
    expect(selectWithinBudget(ranked, 100_000)).toHaveLength(3);
  });

  it("estimateTokens is monotonic in length", () => {
    expect(estimateTokens("xxxx")).toBeGreaterThanOrEqual(1);
    expect(estimateTokens("x".repeat(40))).toBeGreaterThan(estimateTokens("xxxx"));
  });
});

describe("buildMemoryBlock", () => {
  it("returns an empty string for no memories", () => {
    expect(buildMemoryBlock([])).toBe("");
  });

  it("renders the section heading and owner-friendly partition labels", () => {
    const block = buildMemoryBlock([
      row({ partition: "model_of_you", body: "closes direct" }),
      row({ partition: "semantic", body: "prefers Tuesday calls" }),
    ]);
    expect(block).toContain("## Your memory of this owner");
    expect(block).toContain("### How you work");
    expect(block).toContain("### What it learned");
    expect(block).toContain("- closes direct");
    expect(block).toContain("- prefers Tuesday calls");
  });
});
