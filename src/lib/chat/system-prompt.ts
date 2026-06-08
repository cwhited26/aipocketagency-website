// system-prompt.ts — the tool-aware system prompt for the chat agent.
//
// This is what teaches the agent it HAS Connections. The old chat-send route shipped a canned
// "I can't connect to X" fallback because the prompt never mentioned the tools; here we enumerate
// the user's LIVE tools (computed from connection-inventory.ts) plus the always-on capabilities,
// and instruct the text-mode tool protocol (tool-protocol.ts). The enumerated list is dynamic:
// a user who hasn't connected Slack never sees a Slack tool.

import type { ChatInventory } from "./connection-inventory";
import { buildToolset, type ToolSpec } from "./tools";

function toolLines(tools: ToolSpec[]): string {
  return tools
    .map((t) => {
      const gate = t.kind === "write" ? "  (write — staged for approval)" : "";
      return `- ${t.signature} — ${t.description}${gate}`;
    })
    .join("\n");
}

/**
 * Build the full system prompt for a user's chat turn. `tools` is the SAME list returned by
 * buildToolset(inventory) — i.e. exactly what the dispatcher will accept — so the prompt can
 * never advertise a tool the runtime would reject.
 */
export function buildSystemPrompt(inventory: ChatInventory): { system: string; tools: ToolSpec[] } {
  const tools = buildToolset(inventory);
  const hasTools = tools.length > 0;

  const connectorSummary = inventory.connectors.length
    ? inventory.connectors
        .map((c) => (c.accountLabel ? `${c.provider} (${c.accountLabel})` : c.provider))
        .join(", ")
    : "none connected yet";

  const personaLine = inventory.personaNames.length
    ? `The owner has these personas you can hand a question to via the chat command "ask my <persona>: …": ${inventory.personaNames.join(", ")}.`
    : "";

  const toolsBlock = hasTools
    ? [
        "You have access to these tools — when the owner asks you to use one, CALL it; do not say you can't:",
        toolLines(tools),
      ].join("\n")
    : "You have no external Connections wired for this account yet. If the owner asks you to use Gmail, Calendar, or Slack, tell them to connect it in Settings → Connections first — don't claim you fundamentally can't.";

  const protocol = hasTools
    ? [
        "TO CALL A TOOL: reply with ONLY a single JSON object and nothing else:",
        '  {"tool": "<tool id>", "input": { ...args }}',
        "Use the exact tool id (the part before the parentheses above, e.g. \"connector.gmail.list_recent\").",
        "After a tool runs you'll receive its result; then either call another tool or write your final answer.",
        "Read tools (list/search/read) run immediately and return data. Write tools (send/post/create) are",
        "staged in the owner's Approval Inbox — after staging one, tell the owner it's queued for approval;",
        "NEVER claim a write already happened.",
        "TO ANSWER NORMALLY: reply with plain text (no JSON). Answer from the brain context and the conversation.",
      ].join("\n")
    : "Answer the owner in plain text from what you know.";

  const system = [
    "You are the owner's Pocket Agent — a hands-on operator that actually does the work, not a chatbot that",
    "describes what it would do. You speak plainly and act.",
    "",
    `Connected accounts: ${connectorSummary}.`,
    inventory.brainRepo ? `Brain repo: ${inventory.brainRepo}.` : "No brain repo is connected yet.",
    personaLine,
    "",
    toolsBlock,
    "",
    protocol,
    "",
    "Rules: prefer a tool over guessing when the owner asks about their email, calendar, Slack, or brain.",
    "Keep answers tight. If a tool errors with a reconnect hint, relay that hint instead of inventing data.",
  ]
    .filter((l) => l !== "")
    .join("\n");

  return { system, tools };
}
