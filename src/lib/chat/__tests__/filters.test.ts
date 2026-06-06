import { describe, it, expect } from "vitest";
import {
  SLASH_COMMANDS,
  railCommands,
  parseSlashCommand,
  isSlashInput,
  slashAutocomplete,
  resolveSlashAction,
  messageMatchesFilter,
  normalizeFilter,
  parseIntent,
} from "../filters";
import { FILTER_TAGS, DEFAULT_FILTER, type FilterTag } from "../types";

describe("parseSlashCommand", () => {
  it("parses a bare command", () => {
    const r = parseSlashCommand("/tasks");
    expect(r?.command.name).toBe("tasks");
    expect(r?.args).toBe("");
  });

  it("parses a command with args", () => {
    const r = parseSlashCommand("/capture voice");
    expect(r?.command.name).toBe("capture");
    expect(r?.args).toBe("voice");
  });

  it("is case-insensitive and tolerates leading whitespace", () => {
    expect(parseSlashCommand("   /TASKS")?.command.name).toBe("tasks");
  });

  it("resolves aliases to the canonical command", () => {
    expect(parseSlashCommand("/docs")?.command.name).toBe("documents");
    expect(parseSlashCommand("/memory")?.command.name).toBe("brain");
    expect(parseSlashCommand("/ask")?.command.name).toBe("agent");
  });

  it("returns null for non-slash input", () => {
    expect(parseSlashCommand("tasks")).toBeNull();
    expect(parseSlashCommand("hello there")).toBeNull();
  });

  it("returns null for an unknown command", () => {
    expect(parseSlashCommand("/nonsense")).toBeNull();
  });
});

describe("isSlashInput", () => {
  it("detects slash inputs (with leading whitespace)", () => {
    expect(isSlashInput("/x")).toBe(true);
    expect(isSlashInput("  /x")).toBe(true);
    expect(isSlashInput("x")).toBe(false);
  });
});

describe("slashAutocomplete", () => {
  it("suggests rail commands for a bare slash", () => {
    const out = slashAutocomplete("/");
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((c) => c.inRail)).toBe(true);
  });

  it("filters by prefix on name and alias", () => {
    const names = slashAutocomplete("/co").map((c) => c.name);
    expect(names).toContain("connections"); // name prefix
    expect(names).toContain("community"); // name prefix
  });

  it("matches aliases", () => {
    const names = slashAutocomplete("/me").map((c) => c.name);
    expect(names).toContain("brain"); // via alias "memory"
  });

  it("stops suggesting once a space is typed", () => {
    expect(slashAutocomplete("/capture ")).toEqual([]);
  });

  it("returns [] for non-slash input", () => {
    expect(slashAutocomplete("hello")).toEqual([]);
  });

  it("respects the limit", () => {
    expect(slashAutocomplete("/", 3).length).toBeLessThanOrEqual(3);
  });
});

describe("resolveSlashAction", () => {
  it("maps a plain command to a filter action with its tag", () => {
    const action = resolveSlashAction(parseSlashCommand("/tasks")!);
    expect(action.kind).toBe("filter");
    if (action.kind === "filter") expect(action.filter).toBe("tasks");
  });

  it("maps /capture voice to the voice recorder", () => {
    const action = resolveSlashAction(parseSlashCommand("/capture voice")!);
    expect(action.kind).toBe("capture-voice");
  });

  it("maps a bare /capture to the capture filter", () => {
    const action = resolveSlashAction(parseSlashCommand("/capture")!);
    expect(action.kind).toBe("filter");
  });

  it("maps /upload to the upload action", () => {
    const action = resolveSlashAction(parseSlashCommand("/upload")!);
    expect(action.kind).toBe("upload");
  });

  it("maps /help to navigation", () => {
    const action = resolveSlashAction(parseSlashCommand("/help")!);
    expect(action.kind).toBe("navigate");
    if (action.kind === "navigate") expect(action.href).toBe("/app/home/help");
  });

  it("maps standalone-app commands (work/routines/community) to navigation", () => {
    for (const name of ["work", "routines", "community"]) {
      const action = resolveSlashAction(parseSlashCommand(`/${name}`)!);
      expect(action.kind).toBe("navigate");
    }
  });
});

describe("messageMatchesFilter", () => {
  it("matches when tags contain the filter", () => {
    expect(messageMatchesFilter(["tasks", "general"], "tasks")).toBe(true);
  });
  it("does not match when tags omit the filter", () => {
    expect(messageMatchesFilter(["general"], "tasks")).toBe(false);
  });
  it("general matches general-tagged rows", () => {
    expect(messageMatchesFilter(["general"], "general")).toBe(true);
  });
});

describe("normalizeFilter", () => {
  it("passes through a valid tag", () => {
    expect(normalizeFilter("personas")).toBe("personas");
  });
  it("falls back to default for unknown / null", () => {
    expect(normalizeFilter("bogus")).toBe(DEFAULT_FILTER);
    expect(normalizeFilter(null)).toBe(DEFAULT_FILTER);
  });
});

describe("registry integrity", () => {
  it("every command's filterTag is a valid tag", () => {
    const valid = new Set<FilterTag>(FILTER_TAGS);
    for (const c of SLASH_COMMANDS) expect(valid.has(c.filterTag)).toBe(true);
  });
  it("rail commands are a non-empty ordered subset", () => {
    expect(railCommands().length).toBeGreaterThan(0);
    expect(railCommands().every((c) => c.inRail)).toBe(true);
  });
  it("command names are unique", () => {
    const names = SLASH_COMMANDS.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("parseIntent", () => {
  it("recognizes 'add to memory:' prefix", () => {
    const r = parseIntent("add to memory: Patrick prefers texts over calls");
    expect(r.kind).toBe("memory");
    if (r.kind === "memory") expect(r.content).toBe("Patrick prefers texts over calls");
  });

  it("recognizes 'remember' and 'note to brain'", () => {
    expect(parseIntent("remember: invoice net-30").kind).toBe("memory");
    expect(parseIntent("note to brain - call the lumber yard").kind).toBe("memory");
  });

  it("does not treat an empty memory body as a memory intent", () => {
    expect(parseIntent("add to memory:   ").kind).toBe("plain");
  });

  it("recognizes 'ask my <persona>: <question>'", () => {
    const r = parseIntent("ask my Virtual Sales Manager: how do I price a re-roof?");
    expect(r.kind).toBe("persona");
    if (r.kind === "persona") {
      expect(r.personaQuery).toBe("Virtual Sales Manager");
      expect(r.question).toBe("how do I price a re-roof?");
    }
  });

  it("recognizes the loose question form without a colon", () => {
    const r = parseIntent("ask my coach what should I do today?");
    expect(r.kind).toBe("persona");
    if (r.kind === "persona") {
      expect(r.personaQuery).toBe("coach");
      expect(r.question).toBe("what should I do today?");
    }
  });

  it("falls back to plain for ordinary messages", () => {
    const r = parseIntent("draft a follow-up to the Williams job");
    expect(r.kind).toBe("plain");
    if (r.kind === "plain") expect(r.content).toBe("draft a follow-up to the Williams job");
  });
});
