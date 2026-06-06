import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  CARD_KINDS,
  CARD_PAYLOAD_SCHEMAS,
  validateCardPayload,
  ChatMessageSchema,
  SendMessageSchema,
  SetFilterSchema,
  type CardKind,
} from "../types";

// A valid sample payload per card kind. Doubles as the renderer prop-contract fixture:
// if a renderer's props drift from its schema, this fixture (and the renderer) must update
// together.
const VALID_PAYLOADS: Record<CardKind, unknown> = {
  memory_write: { summary: "Saved a fact", tier: "Active", path: "memory/x.md", sha: "abc123" },
  persona_invoke: {
    personaId: "p1",
    personaName: "Virtual Sales Manager",
    question: "How do I price a re-roof?",
    openHref: "/app/personas/p1",
  },
  doc_preview: { fileName: "proposal.pdf", mimeType: "application/pdf", sizeBytes: 12345, excerpt: "Dear..." },
  voice_memo: { durationSeconds: 42, transcriptSnippet: "call patrick back", path: "inbox/voice/x.md" },
  screenshot: { extractedText: "Total: $6,000", fileName: "shot.png" },
  sub_agent_activity: { label: "Job file lookup", phase: "plan", note: "reviewing photos" },
  action_approval: { connector: "gmail", action: "send", preview: "Subject: Williams" },
  persona_response: { personaId: "p1", personaName: "Coach", answer: "Do the hardest thing first." },
};

describe("card payload schemas", () => {
  it("has a schema for every card kind", () => {
    for (const kind of CARD_KINDS) {
      expect(CARD_PAYLOAD_SCHEMAS[kind]).toBeDefined();
    }
  });

  it("validates a correct payload for each kind", () => {
    for (const kind of CARD_KINDS) {
      expect(() => validateCardPayload(kind, VALID_PAYLOADS[kind])).not.toThrow();
    }
  });

  it("rejects a payload missing a required field", () => {
    // memory_write requires `summary` + `path`.
    expect(() => validateCardPayload("memory_write", { tier: "Active" })).toThrow(z.ZodError);
  });

  it("rejects an unknown phase on sub_agent_activity", () => {
    expect(() =>
      validateCardPayload("sub_agent_activity", { phase: "teleport" }),
    ).toThrow(z.ZodError);
  });
});

describe("ChatMessageSchema", () => {
  const base = {
    id: "m1",
    user_id: "u1",
    content: "",
    card_payload: null,
    parent_message_id: null,
    filter_tags: ["general"],
    created_at: "2026-06-01T00:00:00.000Z",
    archived_at: null,
  };

  it("accepts a plain user message", () => {
    expect(() =>
      ChatMessageSchema.parse({ ...base, role: "user", content: "hi", card_kind: null }),
    ).not.toThrow();
  });

  it("accepts an inline_card with a kind", () => {
    expect(() =>
      ChatMessageSchema.parse({
        ...base,
        role: "inline_card",
        card_kind: "memory_write",
        card_payload: VALID_PAYLOADS.memory_write,
      }),
    ).not.toThrow();
  });

  it("rejects an inline_card without a kind", () => {
    expect(() =>
      ChatMessageSchema.parse({ ...base, role: "inline_card", card_kind: null }),
    ).toThrow(z.ZodError);
  });

  it("rejects a non-card row that carries a card_kind", () => {
    expect(() =>
      ChatMessageSchema.parse({ ...base, role: "user", card_kind: "memory_write" }),
    ).toThrow(z.ZodError);
  });

  it("rejects an empty filter_tags array", () => {
    expect(() =>
      ChatMessageSchema.parse({ ...base, role: "user", card_kind: null, filter_tags: [] }),
    ).toThrow(z.ZodError);
  });

  it("rejects an unknown filter tag", () => {
    expect(() =>
      ChatMessageSchema.parse({ ...base, role: "user", card_kind: null, filter_tags: ["bogus"] }),
    ).toThrow(z.ZodError);
  });
});

describe("API boundary schemas", () => {
  it("SendMessageSchema rejects empty + over-long", () => {
    expect(() => SendMessageSchema.parse({ content: "" })).toThrow(z.ZodError);
    expect(() => SendMessageSchema.parse({ content: "x".repeat(50_001) })).toThrow(z.ZodError);
    expect(SendMessageSchema.parse({ content: "ok" }).content).toBe("ok");
  });

  it("SetFilterSchema only accepts valid tags", () => {
    expect(SetFilterSchema.parse({ filter: "tasks" }).filter).toBe("tasks");
    expect(() => SetFilterSchema.parse({ filter: "nope" })).toThrow(z.ZodError);
  });
});
