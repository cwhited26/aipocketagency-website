import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "../system-prompt";
import type { ChatInventory } from "../connection-inventory";

function inv(overrides: Partial<ChatInventory> = {}): ChatInventory {
  return {
    connectors: [],
    brainRepo: null,
    brainToken: null,
    paManagedKey: "",
    personaNames: [],
    ...overrides,
  };
}

const BRAIN = "cwhited26/pocket-agent-brain";

describe("buildSystemPrompt — GitHub / brain-repo disambiguation", () => {
  it("names the brain repo as readable on GitHub with the repo path filled in", () => {
    const { system } = buildSystemPrompt(inv({ brainRepo: BRAIN }));
    // Concrete repo path, not an abstract "brain repo".
    expect(system).toContain(BRAIN);
    expect(system).toMatch(/brain repo on GitHub/i);
    expect(system).toMatch(/read any file/i);
    expect(system).toMatch(/list any file or directory/i);
  });

  it("answers YES to 'can you read my GitHub' for the brain repo", () => {
    const { system } = buildSystemPrompt(inv({ brainRepo: BRAIN }));
    expect(system).toMatch(/can you read my GitHub/i);
    expect(system).toMatch(/the honest answer is YES/i);
  });

  it("explicitly forbids the agent from claiming it has no GitHub access", () => {
    const { system } = buildSystemPrompt(inv({ brainRepo: BRAIN }));
    // The prompt must carry the guard against the exact failure mode we're fixing.
    expect(system).toMatch(/Never say you have no GitHub access/i);
  });

  it("separates the general GitHub Connection as not-yet-wired, with the plain-English fallback", () => {
    const { system } = buildSystemPrompt(inv({ brainRepo: BRAIN }));
    expect(system).toMatch(/GENERAL Connection/);
    expect(system).toMatch(/other repos/i);
    expect(system).toMatch(/is NOT connected yet/);
    expect(system).toMatch(/make do with the brain for now/i);
  });

  it("exposes brain.list / brain.read / brain.search as live tools when a brain repo is connected", () => {
    const { tools } = buildSystemPrompt(inv({ brainRepo: BRAIN }));
    const ids = tools.map((t) => t.id);
    expect(ids).toContain("brain.list");
    expect(ids).toContain("brain.read");
    expect(ids).toContain("brain.search");
  });

  it("when no brain repo is connected, says nothing on GitHub is readable yet (no false claim)", () => {
    const { system, tools } = buildSystemPrompt(inv());
    expect(system).toMatch(/no brain repo is connected/i);
    expect(system).toMatch(/general Connection/i);
    // No brain tools advertised without a repo.
    expect(tools.map((t) => t.id)).not.toContain("brain.read");
  });

  it("carries the general partial-gap honesty rule", () => {
    const { system } = buildSystemPrompt(inv({ brainRepo: BRAIN }));
    expect(system).toMatch(/never flatten a partial capability/i);
  });
});
