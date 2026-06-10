import { describe, it, expect } from "vitest";
import {
  resolveWriteMode,
  isMemorySuppressed,
  classifyMemoryFromTurn,
  type MemoryLearnLlm,
} from "../write";
import { clampImportance } from "../types";
import type { InboxItem } from "@/lib/pa-inbox-items";

describe("clampImportance", () => {
  it("bounds out-of-range and rounds", () => {
    expect(clampImportance(99)).toBe(10);
    expect(clampImportance(0)).toBe(1);
    expect(clampImportance(5.6)).toBe(6);
    expect(clampImportance(Number.NaN)).toBe(5);
  });
});

describe("resolveWriteMode (SPEC §6)", () => {
  it("auto-fires a trusted candidate at or above the threshold", () => {
    expect(resolveWriteMode({ importance: 8 }, "conversation")).toBe("auto_fire");
    expect(resolveWriteMode({ importance: 10 }, "conversation")).toBe("auto_fire");
  });
  it("stages a trusted candidate below the threshold", () => {
    expect(resolveWriteMode({ importance: 7 }, "conversation")).toBe("stage");
  });
  it("NEVER auto-fires an untrusted-origin candidate, even at importance 10", () => {
    expect(resolveWriteMode({ importance: 10 }, "share_extension")).toBe("stage");
  });
});

function proposal(p: Partial<InboxItem> & { payload: Record<string, unknown> }): InboxItem {
  return {
    id: p.id ?? "i",
    user_id: "owner",
    kind: "persona_memory_proposal",
    title: "t",
    body_md: null,
    source: "persona-memory",
    payload: p.payload,
    status: p.status ?? "pending",
    created_at: "2026-06-01T00:00:00Z",
    resolved_at: null,
    resolved_by: null,
    expires_at: null,
  };
}

describe("isMemorySuppressed", () => {
  const existing = [
    proposal({ status: "pending", payload: { personaId: "pa", body: "Prefers Tuesday calls" } }),
    proposal({ status: "rejected", payload: { personaId: "pa", body: "Hates jargon" } }),
    proposal({ status: "approved", payload: { personaId: "pa", body: "Likes brevity" } }),
  ];

  it("suppresses a pending duplicate (normalized)", () => {
    expect(isMemorySuppressed({ body: "  prefers   tuesday CALLS " }, "pa", existing)).toBe(true);
  });
  it("suppresses a previously rejected write", () => {
    expect(isMemorySuppressed({ body: "Hates jargon" }, "pa", existing)).toBe(true);
  });
  it("does not suppress across personas", () => {
    expect(isMemorySuppressed({ body: "Prefers Tuesday calls" }, "other-persona", existing)).toBe(false);
  });
  it("does not suppress against an already-approved proposal", () => {
    expect(isMemorySuppressed({ body: "Likes brevity" }, "pa", existing)).toBe(false);
  });
});

describe("classifyMemoryFromTurn", () => {
  const llmReturning = (text: string): MemoryLearnLlm => async () => ({ ok: true, text });

  it("parses candidates and clamps importance the model emitted", async () => {
    const out = await classifyMemoryFromTurn(
      { userMessage: "u", assistantText: "a" },
      llmReturning(
        JSON.stringify({
          candidates: [{ partition: "semantic", tier: "persona", body: "fact", importance: 7 }],
        }),
      ),
    );
    expect(out.candidates).toHaveLength(1);
    expect(out.candidates[0].importance).toBe(7);
  });

  it("returns no candidates on garbage", async () => {
    const out = await classifyMemoryFromTurn({ userMessage: "u", assistantText: "a" }, llmReturning("not json"));
    expect(out.candidates).toEqual([]);
  });

  it("returns no candidates when the LLM errors or throws", async () => {
    const err: MemoryLearnLlm = async () => ({ ok: false, error: "boom" });
    const thrower: MemoryLearnLlm = async () => {
      throw new Error("network");
    };
    expect((await classifyMemoryFromTurn({ userMessage: "u", assistantText: "a" }, err)).candidates).toEqual([]);
    expect((await classifyMemoryFromTurn({ userMessage: "u", assistantText: "a" }, thrower)).candidates).toEqual([]);
  });
});
