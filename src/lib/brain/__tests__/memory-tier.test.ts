import { describe, it, expect } from "vitest";
import {
  classifyMemoryTier,
  tieredPathForNewMemory,
  tierFromPath,
  MEMORY_TIER_FOLDER,
} from "../memory-tier";

describe("classifyMemoryTier", () => {
  it("routes lesson/pattern language to learning (highest priority)", () => {
    expect(classifyMemoryTier("retro.md", "Lessons learned from the launch").tier).toBe(
      "learning",
    );
    expect(classifyMemoryTier("x.md", "This is a reusable playbook").tier).toBe("learning");
    expect(classifyMemoryTier("postmortem.md", "Post-mortem: what we learned").tier).toBe(
      "learning",
    );
  });

  it("lets learning override otherwise work/knowledge-heavy content", () => {
    // Has work + knowledge words, but the lesson signal must win.
    const c = classifyMemoryTier(
      "note.md",
      "Working on the Acme client deadline — the lesson learned is to scope earlier",
    );
    expect(c.tier).toBe("learning");
  });

  it("routes active-task language to work", () => {
    expect(classifyMemoryTier("todo.md", "TODO: ship the invoice").tier).toBe("work");
    expect(classifyMemoryTier("x.md", "Currently blocked waiting on the vendor reply").tier).toBe(
      "work",
    );
    expect(classifyMemoryTier("x.md", "Next steps for this week").tier).toBe("work");
  });

  it("routes durable nouns to knowledge", () => {
    expect(classifyMemoryTier("acme.md", "Background on the Acme company and their product").tier).toBe(
      "knowledge",
    );
    expect(classifyMemoryTier("pricing.md", "Our pricing for the core product").tier).toBe(
      "knowledge",
    );
  });

  it("breaks work/knowledge ties in favor of work", () => {
    // one work signal, one knowledge signal
    const c = classifyMemoryTier("x.md", "Working on the client account");
    expect(c.tier).toBe("work");
  });

  it("falls back to knowledge when nothing matches", () => {
    const c = classifyMemoryTier("misc.md", "Some unremarkable freeform note text");
    expect(c.tier).toBe("knowledge");
    expect(c.reason).toMatch(/defaulted/i);
  });

  it("weights the file name as a signal", () => {
    expect(classifyMemoryTier("lessons-learned.md", "short body").tier).toBe("learning");
    expect(classifyMemoryTier("todo.md", "short body").tier).toBe("work");
  });
});

describe("tieredPathForNewMemory", () => {
  it("reroutes a flat memory path into the classified tier folder", () => {
    const r = tieredPathForNewMemory("memory/acme.md", "Background on the Acme company");
    expect(r.tier).toBe("knowledge");
    expect(r.path).toBe(`${MEMORY_TIER_FOLDER.knowledge}/acme.md`);
  });

  it("leaves already-tiered paths untouched", () => {
    const r = tieredPathForNewMemory("memory/work/task.md", "TODO ship it");
    expect(r.tier).toBeNull();
    expect(r.path).toBe("memory/work/task.md");
  });

  it("leaves non-memory paths untouched", () => {
    const r = tieredPathForNewMemory("TELOS.md", "whatever");
    expect(r.tier).toBeNull();
    expect(r.path).toBe("TELOS.md");
  });
});

describe("tierFromPath", () => {
  it("derives tier from a tiered path", () => {
    expect(tierFromPath("memory/work/a.md")).toBe("work");
    expect(tierFromPath("memory/knowledge/a.md")).toBe("knowledge");
    expect(tierFromPath("memory/learning/a.md")).toBe("learning");
  });

  it("returns null for flat/untiered memory paths", () => {
    expect(tierFromPath("memory/a.md")).toBeNull();
    expect(tierFromPath("voice/a.md")).toBeNull();
  });
});
