import { describe, it, expect } from "vitest";
import { parseAgentTurn } from "../tool-protocol";
import { buildToolset } from "../tools";
import { buildSystemPrompt } from "../system-prompt";
import type { ChatInventory } from "../connection-inventory";

function inventory(overrides: Partial<ChatInventory> = {}): ChatInventory {
  return {
    connectors: [],
    brainRepo: null,
    brainToken: null,
    paManagedKey: "",
    personaNames: [],
    ...overrides,
  };
}

describe("parseAgentTurn", () => {
  it("treats plain prose as a final answer", () => {
    const t = parseAgentTurn("Your next meeting is at 3pm.");
    expect(t.kind).toBe("final");
    if (t.kind === "final") expect(t.text).toContain("3pm");
  });

  it("parses a bare tool-call object", () => {
    const t = parseAgentTurn('{"tool":"connector.gmail.list_recent","input":{"n":5}}');
    expect(t.kind).toBe("tool");
    if (t.kind === "tool") {
      expect(t.call.tool).toBe("connector.gmail.list_recent");
      expect(t.call.input.n).toBe(5);
    }
  });

  it("extracts a tool call even when wrapped in a ```json fence + prose", () => {
    const raw = 'Sure, let me check.\n```json\n{"tool":"connector.gmail.search","input":{"query":"from:patrick"}}\n```';
    const t = parseAgentTurn(raw);
    expect(t.kind).toBe("tool");
    if (t.kind === "tool") expect(t.call.input.query).toBe("from:patrick");
  });

  it("does not mistake a JSON object without a tool field for a call", () => {
    const t = parseAgentTurn('{"answer":"42"}');
    expect(t.kind).toBe("final");
  });

  it("respects braces inside string values when scanning", () => {
    const t = parseAgentTurn('{"tool":"connector.slack.post_message","input":{"text":"use {curly} braces"}}');
    expect(t.kind).toBe("tool");
    if (t.kind === "tool") expect(t.call.input.text).toBe("use {curly} braces");
  });

  it("defaults input to an empty object when omitted", () => {
    const t = parseAgentTurn('{"tool":"connector.slack.list_channels"}');
    expect(t.kind).toBe("tool");
    if (t.kind === "tool") expect(t.call.input).toEqual({});
  });
});

describe("buildToolset", () => {
  it("offers no tools for a bare account", () => {
    expect(buildToolset(inventory())).toHaveLength(0);
  });

  it("offers brain tools only when a brain repo is connected", () => {
    const ids = buildToolset(inventory({ brainRepo: "cwhited26/whited-brain" })).map((t) => t.id);
    expect(ids).toContain("brain.read");
    expect(ids).toContain("brain.search");
  });

  it("offers a connector's tools only when it is live", () => {
    const withGmail = buildToolset(inventory({ connectors: [{ provider: "gmail", accountLabel: "chase@x.com" }] }));
    const ids = withGmail.map((t) => t.id);
    expect(ids).toContain("connector.gmail.list_recent");
    expect(ids).toContain("connector.gmail.send");
    // Slack isn't connected → no Slack tools.
    expect(ids.some((id) => id.startsWith("connector.slack."))).toBe(false);
  });

  it("marks send/post/create as write tools", () => {
    const tools = buildToolset(
      inventory({ connectors: [{ provider: "slack", accountLabel: "Acme" }] }),
    );
    const post = tools.find((t) => t.id === "connector.slack.post_message");
    expect(post?.kind).toBe("write");
    expect(post?.connector).toBe("slack");
    expect(post?.action).toBe("post_message");
  });
});

describe("buildSystemPrompt", () => {
  it("enumerates the live tools and never advertises unconnected ones", () => {
    const inv = inventory({
      brainRepo: "cwhited26/whited-brain",
      connectors: [{ provider: "gmail", accountLabel: "chase@x.com" }],
    });
    const { system, tools } = buildSystemPrompt(inv);
    expect(system).toContain("connector.gmail.list_recent");
    expect(system).toContain("brain.read");
    expect(system).not.toContain("connector.slack");
    // The prompt's tool list is exactly what the dispatcher will accept.
    expect(tools.map((t) => t.id).sort()).toEqual(buildToolset(inv).map((t) => t.id).sort());
  });

  it("tells a bare account to connect something rather than claiming it can't", () => {
    const { system } = buildSystemPrompt(inventory());
    expect(system).toContain("Settings → Connections");
    expect(system.toLowerCase()).not.toContain("i can't connect");
  });
});
