import { describe, it, expect } from "vitest";
import {
  contentTokens,
  tokenOverlap,
  findSupersededAttribute,
  isDuplicateOfLive,
  SOUL_SUPERSEDE_OVERLAP,
} from "../soul-merge";
import type { SoulAttributeRow, SoulAttributeKind } from "../soul-types";

function row(p: Partial<SoulAttributeRow> & { kind?: SoulAttributeKind }): SoulAttributeRow {
  return {
    id: p.id ?? "s1",
    persona_id: p.persona_id ?? "pa",
    owner_id: p.owner_id ?? "owner",
    attribute_kind: p.kind ?? p.attribute_kind ?? "response_preference",
    attribute_summary: p.attribute_summary ?? "summary",
    attribute_body: p.attribute_body ?? null,
    confidence: p.confidence ?? 0.7,
    source_session_id: p.source_session_id ?? null,
    locked: p.locked ?? false,
    superseded_by: p.superseded_by ?? null,
    created_at: p.created_at ?? "2026-06-01T00:00:00Z",
    updated_at: p.updated_at ?? "2026-06-01T00:00:00Z",
  };
}

describe("contentTokens", () => {
  it("drops stopwords, short words, and non-alpha", () => {
    const t = contentTokens("The owner prefers terse, direct replies!!");
    expect(t.has("terse")).toBe(true);
    expect(t.has("direct")).toBe(true);
    expect(t.has("replies")).toBe(true);
    expect(t.has("the")).toBe(false); // stopword
    expect(t.has("prefers")).toBe(false); // stopword
  });
});

describe("tokenOverlap", () => {
  it("is 0 for disjoint sets and 1 for identical", () => {
    expect(tokenOverlap(new Set(["a"]), new Set(["b"]))).toBe(0);
    expect(tokenOverlap(new Set(["a", "b"]), new Set(["a", "b"]))).toBe(1);
  });
  it("is 0 when both empty", () => {
    expect(tokenOverlap(new Set(), new Set())).toBe(0);
  });
});

describe("findSupersededAttribute", () => {
  it("supersedes an existing same-kind attribute about the same dimension", () => {
    const existing = [
      row({ id: "old", kind: "response_preference", attribute_summary: "Prefers long, detailed replies" }),
    ];
    const victim = findSupersededAttribute(existing, {
      kind: "response_preference",
      summary: "Prefers terse, short replies",
    });
    expect(victim?.id).toBe("old"); // same kind + "replies" overlap → same dimension, replaced
  });

  it("does NOT supersede across different kinds", () => {
    const existing = [
      row({ id: "old", kind: "communication_style", attribute_summary: "Prefers terse replies" }),
    ];
    const victim = findSupersededAttribute(existing, {
      kind: "response_preference",
      summary: "Prefers terse replies",
    });
    expect(victim).toBeNull();
  });

  it("does NOT supersede two distinct boundaries (low overlap)", () => {
    const existing = [
      row({ id: "b1", kind: "boundary", attribute_summary: "Never send invoices without review" }),
    ];
    const victim = findSupersededAttribute(existing, {
      kind: "boundary",
      summary: "Always confirm meeting times by text",
    });
    expect(victim).toBeNull();
  });

  it("breaks overlap ties toward the oldest prior belief", () => {
    const existing = [
      row({ id: "newer", attribute_summary: "Wants concise bullet replies", created_at: "2026-06-10T00:00:00Z" }),
      row({ id: "older", attribute_summary: "Wants concise bullet replies", created_at: "2026-06-01T00:00:00Z" }),
    ];
    const victim = findSupersededAttribute(existing, {
      kind: "response_preference",
      summary: "Wants concise bullet replies",
    });
    expect(victim?.id).toBe("older");
  });

  it("threshold constant is in (0,1)", () => {
    expect(SOUL_SUPERSEDE_OVERLAP).toBeGreaterThan(0);
    expect(SOUL_SUPERSEDE_OVERLAP).toBeLessThan(1);
  });
});

describe("isDuplicateOfLive", () => {
  it("matches same kind + normalised summary", () => {
    const existing = [row({ kind: "boundary", attribute_summary: "Always  ask  first" })];
    expect(
      isDuplicateOfLive(existing, { kind: "boundary", summary: "always ask first" }),
    ).toBe(true);
  });
  it("does not match a different kind", () => {
    const existing = [row({ kind: "boundary", attribute_summary: "always ask first" })];
    expect(
      isDuplicateOfLive(existing, { kind: "working_dynamic", summary: "always ask first" }),
    ).toBe(false);
  });
});
