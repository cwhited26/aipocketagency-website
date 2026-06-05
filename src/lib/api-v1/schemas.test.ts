import { describe, it, expect } from "vitest";
import {
  brainPathSchema,
  apiMemoryTierSchema,
  brainFileWriteBodySchema,
  brainFileQuerySchema,
  memoryTierQuerySchema,
  memoryEntryBodySchema,
  personaInvokeBodySchema,
  zonesResponseSchema,
  brainTreeResponseSchema,
} from "./schemas";

describe("brainPathSchema", () => {
  it("accepts a normal repo-relative path", () => {
    expect(brainPathSchema.safeParse("memory/knowledge/acme.md").success).toBe(true);
  });
  it("rejects an absolute path", () => {
    expect(brainPathSchema.safeParse("/etc/passwd").success).toBe(false);
  });
  it("rejects traversal segments", () => {
    expect(brainPathSchema.safeParse("memory/../../secrets.md").success).toBe(false);
  });
  it("rejects an empty path", () => {
    expect(brainPathSchema.safeParse("").success).toBe(false);
  });
});

describe("memory tier schema", () => {
  it("accepts the three public tiers", () => {
    for (const t of ["work", "knowledge", "patterns"]) {
      expect(apiMemoryTierSchema.safeParse(t).success).toBe(true);
    }
  });
  it("rejects the internal name 'learning'", () => {
    expect(apiMemoryTierSchema.safeParse("learning").success).toBe(false);
  });
  it("memoryTierQuerySchema validates the tier query", () => {
    expect(memoryTierQuerySchema.safeParse({ tier: "knowledge" }).success).toBe(true);
    expect(memoryTierQuerySchema.safeParse({ tier: "bogus" }).success).toBe(false);
  });
});

describe("brain file schemas", () => {
  it("query requires a valid path", () => {
    expect(brainFileQuerySchema.safeParse({ path: "memory/x.md" }).success).toBe(true);
    expect(brainFileQuerySchema.safeParse({ path: "../x" }).success).toBe(false);
  });
  it("write body defaults mode to replace", () => {
    const parsed = brainFileWriteBodySchema.parse({ path: "memory/x.md", content: "hi" });
    expect(parsed.mode).toBe("replace");
  });
  it("write body rejects an oversized payload boundary type", () => {
    expect(brainFileWriteBodySchema.safeParse({ path: "memory/x.md", content: 123 }).success).toBe(false);
  });
});

describe("memory entry schema", () => {
  it("requires name + content", () => {
    expect(memoryEntryBodySchema.safeParse({ name: "Acme", content: "facts" }).success).toBe(true);
    expect(memoryEntryBodySchema.safeParse({ name: "Acme" }).success).toBe(false);
    expect(memoryEntryBodySchema.safeParse({ content: "facts" }).success).toBe(false);
  });
  it("accepts an explicit tier", () => {
    expect(memoryEntryBodySchema.safeParse({ name: "x", content: "y", tier: "patterns" }).success).toBe(true);
    expect(memoryEntryBodySchema.safeParse({ name: "x", content: "y", tier: "learning" }).success).toBe(false);
  });
});

describe("persona invoke schema", () => {
  it("requires a message", () => {
    expect(personaInvokeBodySchema.safeParse({ message: "hello" }).success).toBe(true);
    expect(personaInvokeBodySchema.safeParse({ message: "" }).success).toBe(false);
  });
  it("conversationId must be a uuid when present", () => {
    expect(personaInvokeBodySchema.safeParse({ message: "x", conversationId: "not-uuid" }).success).toBe(false);
  });
});

describe("response schemas", () => {
  it("zonesResponseSchema parses a zone list", () => {
    const r = zonesResponseSchema.safeParse({
      zones: [{ name: "user-private", patterns: ["personal/**"], private: true }],
      isDefault: false,
    });
    expect(r.success).toBe(true);
  });
  it("brainTreeResponseSchema parses a tree", () => {
    const r = brainTreeResponseSchema.safeParse({
      tree: [{ path: "memory/x.md", type: "blob" }],
      blockedCount: 0,
    });
    expect(r.success).toBe(true);
  });
});
