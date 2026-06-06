import { describe, it, expect } from "vitest";
import {
  searchMessages,
  findMatches,
  matchesSource,
  payloadSearchText,
  exportToJson,
  exportToMarkdown,
  SEARCH_SOURCES,
} from "../search";
import type { ChatMessage } from "../types";

function msg(overrides: Partial<ChatMessage>): ChatMessage {
  return {
    id: "m1",
    user_id: "u1",
    role: "user",
    content: "",
    card_kind: null,
    card_payload: null,
    parent_message_id: null,
    filter_tags: ["general"],
    created_at: "2026-06-01T12:00:00.000Z",
    archived_at: null,
    ...overrides,
  };
}

describe("findMatches", () => {
  it("finds all case-insensitive substring ranges", () => {
    const ranges = findMatches("Roof and roof and ROOF", "roof");
    expect(ranges).toHaveLength(3);
    expect(ranges[0]).toEqual({ start: 0, end: 4 });
  });
  it("returns [] for an empty query", () => {
    expect(findMatches("anything", "  ")).toEqual([]);
  });
  it("returns [] when there is no match", () => {
    expect(findMatches("hello", "zzz")).toEqual([]);
  });
});

describe("payloadSearchText", () => {
  it("flattens nested string values", () => {
    const text = payloadSearchText({ summary: "wrote a note", nested: { path: "memory/x.md" } });
    expect(text).toContain("wrote a note");
    expect(text).toContain("memory/x.md");
  });
  it("handles null / arrays", () => {
    expect(payloadSearchText(null)).toBe("");
    expect(payloadSearchText(["a", "b"])).toBe("a b");
  });
});

describe("matchesSource", () => {
  it("matches card kinds to their source facet", () => {
    const memCard = msg({ role: "inline_card", card_kind: "memory_write", card_payload: {} });
    expect(matchesSource(memCard, "memory")).toBe(true);
    expect(matchesSource(memCard, "voice")).toBe(false);
  });
  it("groups both persona card kinds under 'persona'", () => {
    const invoke = msg({ role: "inline_card", card_kind: "persona_invoke", card_payload: {} });
    const resp = msg({ role: "inline_card", card_kind: "persona_response", card_payload: {} });
    expect(matchesSource(invoke, "persona")).toBe(true);
    expect(matchesSource(resp, "persona")).toBe(true);
  });
  it("'all' matches everything", () => {
    expect(matchesSource(msg({}), "all")).toBe(true);
  });
  it("'general' matches non-card rows only", () => {
    expect(matchesSource(msg({ role: "assistant" }), "general")).toBe(true);
    const card = msg({ role: "inline_card", card_kind: "doc_preview", card_payload: {} });
    expect(matchesSource(card, "general")).toBe(false);
  });
  it("exposes a stable source list", () => {
    expect(SEARCH_SOURCES).toContain("all");
    expect(SEARCH_SOURCES).toContain("screenshot");
  });
});

describe("searchMessages", () => {
  const messages: ChatMessage[] = [
    msg({ id: "a", content: "Follow up with Patrick about the roof", created_at: "2026-06-01T10:00:00.000Z" }),
    msg({
      id: "b",
      role: "inline_card",
      card_kind: "memory_write",
      card_payload: { summary: "Patrick prefers texts", path: "memory/patrick.md" },
      content: "",
      created_at: "2026-06-02T10:00:00.000Z",
    }),
    msg({ id: "c", content: "unrelated note", created_at: "2026-06-03T10:00:00.000Z" }),
  ];

  it("substring-searches across content and card payload", () => {
    const res = searchMessages(messages, { text: "patrick" });
    const ids = res.map((r) => r.message.id);
    expect(ids).toContain("a");
    expect(ids).toContain("b");
    expect(ids).not.toContain("c");
  });

  it("returns match ranges for highlighting", () => {
    const res = searchMessages(messages, { text: "roof" });
    expect(res[0].matches.length).toBeGreaterThan(0);
  });

  it("filters by source facet", () => {
    const res = searchMessages(messages, { source: "memory" });
    expect(res.map((r) => r.message.id)).toEqual(["b"]);
  });

  it("filters by inclusive date range", () => {
    const res = searchMessages(messages, {
      from: "2026-06-02T00:00:00.000Z",
      to: "2026-06-02T23:59:59.000Z",
    });
    expect(res.map((r) => r.message.id)).toEqual(["b"]);
  });

  it("with no query returns all (matches empty)", () => {
    const res = searchMessages(messages, {});
    expect(res).toHaveLength(3);
    expect(res[0].matches).toEqual([]);
  });
});

describe("export", () => {
  const messages: ChatMessage[] = [
    msg({ id: "a", role: "user", content: "hello" }),
    msg({
      id: "b",
      role: "inline_card",
      card_kind: "memory_write",
      card_payload: { summary: "saved a fact", path: "memory/x.md" },
    }),
  ];

  it("exports valid JSON round-trippable to the same data", () => {
    const json = exportToJson(messages);
    expect(JSON.parse(json)).toHaveLength(2);
  });

  it("exports Markdown with a heading and content", () => {
    const md = exportToMarkdown(messages);
    expect(md).toContain("# Pocket Agent — chat history");
    expect(md).toContain("hello");
    expect(md).toContain("Memory Write");
    expect(md).toContain("saved a fact");
  });
});
