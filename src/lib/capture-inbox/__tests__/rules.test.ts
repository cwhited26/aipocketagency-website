// Unit tests for the auto-routing rules (lib/capture-inbox/rules) — the pure evaluation half:
// match-pattern semantics (AND across conditions, keyword OR, content-type, source-url, regex, the
// invalid-regex degrade, the empty-pattern never-match guard) and the priority ordering + first-match
// win. No I/O is touched here; the CRUD + write paths run against the share-endpoint integration test.

import { describe, expect, it } from "vitest";
import type { InboxEntry } from "@/lib/pa-inbox";
import type { CaptureRoutingRule } from "../types";
import { evaluateRules, matchesPattern } from "../rules";

function entry(over: Partial<InboxEntry> = {}): InboxEntry {
  return {
    id: over.id ?? "e1",
    ts: over.ts ?? "2026-06-09T12:00:00.000Z",
    kind: over.kind ?? "url",
    content: over.content ?? "A competitor launched new pricing today",
    ...(over.title ? { title: over.title } : {}),
    ...(over.sourceUrl ? { sourceUrl: over.sourceUrl } : {}),
  };
}

function rule(over: Partial<CaptureRoutingRule>): CaptureRoutingRule {
  return {
    id: over.id ?? "r1",
    owner_id: "owner-1",
    match_pattern: over.match_pattern ?? {},
    target_path: over.target_path ?? "brain/notes",
    enabled: over.enabled ?? true,
    priority: over.priority ?? 0,
    created_at: over.created_at ?? "2026-06-01T00:00:00.000Z",
    updated_at: over.updated_at ?? "2026-06-01T00:00:00.000Z",
  };
}

describe("matchesPattern", () => {
  it("matches when any one keyword appears (case-insensitive)", () => {
    expect(matchesPattern(entry({ content: "New PRICING page" }), { keywords: ["pricing", "launch"] })).toBe(true);
    expect(matchesPattern(entry({ content: "nothing relevant" }), { keywords: ["pricing"] })).toBe(false);
  });

  it("matches a source-url substring", () => {
    expect(
      matchesPattern(entry({ sourceUrl: "https://www.youtube.com/watch?v=x" }), {
        sourceUrlContains: "youtube.com",
      }),
    ).toBe(true);
    expect(matchesPattern(entry({ sourceUrl: "https://vimeo.com/x" }), { sourceUrlContains: "youtube.com" })).toBe(
      false,
    );
  });

  it("matches the content type exactly", () => {
    expect(matchesPattern(entry({ kind: "voice" }), { contentType: "voice" })).toBe(true);
    expect(matchesPattern(entry({ kind: "url" }), { contentType: "voice" })).toBe(false);
  });

  it("matches a regex, and treats an invalid regex as a non-match (never throws)", () => {
    expect(matchesPattern(entry({ content: "invoice #42" }), { regex: "(invoice|receipt)" })).toBe(true);
    expect(matchesPattern(entry({ content: "x" }), { regex: "(unclosed" })).toBe(false);
  });

  it("ANDs across multiple conditions — all must hold", () => {
    const pattern = { keywords: ["pricing"], contentType: "url" as const };
    expect(matchesPattern(entry({ content: "pricing", kind: "url" }), pattern)).toBe(true);
    // keyword matches but the type doesn't → no match
    expect(matchesPattern(entry({ content: "pricing", kind: "note" }), pattern)).toBe(false);
  });

  it("an empty pattern never matches (no accidental catch-all)", () => {
    expect(matchesPattern(entry(), {})).toBe(false);
    expect(matchesPattern(entry(), { keywords: [] })).toBe(false);
  });
});

describe("evaluateRules", () => {
  it("tries higher priority first and returns the first match", () => {
    const low = rule({ id: "low", priority: 1, match_pattern: { keywords: ["pricing"] }, target_path: "brain/low" });
    const high = rule({ id: "high", priority: 10, match_pattern: { keywords: ["pricing"] }, target_path: "brain/high" });
    const matched = evaluateRules(entry({ content: "pricing" }), [low, high]);
    expect(matched?.id).toBe("high");
  });

  it("breaks a priority tie by the older rule (created_at asc)", () => {
    const older = rule({ id: "older", priority: 5, created_at: "2026-06-01T00:00:00.000Z", match_pattern: { keywords: ["x"] } });
    const newer = rule({ id: "newer", priority: 5, created_at: "2026-06-05T00:00:00.000Z", match_pattern: { keywords: ["x"] } });
    expect(evaluateRules(entry({ content: "x" }), [newer, older])?.id).toBe("older");
  });

  it("skips disabled rules", () => {
    const off = rule({ id: "off", enabled: false, priority: 99, match_pattern: { keywords: ["x"] } });
    const on = rule({ id: "on", enabled: true, priority: 1, match_pattern: { keywords: ["x"] } });
    expect(evaluateRules(entry({ content: "x" }), [off, on])?.id).toBe("on");
  });

  it("returns null when nothing matches", () => {
    const r = rule({ match_pattern: { keywords: ["zzz"] } });
    expect(evaluateRules(entry({ content: "abc" }), [r])).toBeNull();
  });
});
