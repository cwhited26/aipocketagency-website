import { describe, it, expect } from "vitest";
import { isOverCap, selectOverflowVictim } from "../prune";
import type { PersonaMemoryRow } from "../types";

function row(p: Partial<PersonaMemoryRow>): PersonaMemoryRow {
  return {
    id: p.id ?? "m",
    owner_id: "owner",
    persona_id: "pa",
    partition: "semantic",
    tier: "persona",
    conversation_id: null,
    body: "x",
    importance: p.importance ?? 5,
    contact_ref: null,
    untrusted_origin: false,
    source_event_id: null,
    superseded_by: null,
    created_at: p.created_at ?? "2026-06-01T00:00:00Z",
    last_read_at: null,
  };
}

describe("isOverCap (SPEC §9)", () => {
  it("is true at the cap and over", () => {
    expect(isOverCap(100, 100)).toBe(true);
    expect(isOverCap(101, 100)).toBe(true);
  });
  it("is false below the cap", () => {
    expect(isOverCap(99, 100)).toBe(false);
  });
  it("is never over for an unlimited (null) cap", () => {
    expect(isOverCap(1_000_000, null)).toBe(false);
  });
});

describe("selectOverflowVictim (SPEC §9 — lowest importance, oldest tie)", () => {
  it("returns null for an empty set", () => {
    expect(selectOverflowVictim([])).toBeNull();
  });

  it("picks the lowest-importance memory", () => {
    const victim = selectOverflowVictim([
      row({ id: "a", importance: 9 }),
      row({ id: "b", importance: 2 }),
      row({ id: "c", importance: 7 }),
    ]);
    expect(victim?.id).toBe("b");
  });

  it("breaks an importance tie by evicting the oldest", () => {
    const victim = selectOverflowVictim([
      row({ id: "new", importance: 3, created_at: "2026-06-09T00:00:00Z" }),
      row({ id: "old", importance: 3, created_at: "2026-01-01T00:00:00Z" }),
    ]);
    expect(victim?.id).toBe("old");
  });
});
