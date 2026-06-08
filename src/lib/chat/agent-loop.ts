// agent-loop.ts — the LLM tool-use loop behind the chat-send route (PA v5 connector bridge).
//
// One user message in → a sequence of chat rows out: tool_call cards for each Connection the agent
// fires, then a final assistant answer. The loop is provider-agnostic (text-mode protocol via
// tool-protocol.ts) and dependency-injected — the LLM call and the tool runner are passed in, so
// the routing logic is unit-tested without the network, the DB, or a real model.
//
// Reads run inline and feed their data back to the model for the next turn; writes stage to the
// Approval Inbox and the model is told to report them as queued. The loop is bounded (maxSteps) so
// a model that never converges can't spin forever.

import type { LlmChatMessage } from "@/lib/llm/types";
import type { ToolCallPayload } from "./types";
import type { ChatInventory } from "./connection-inventory";
import { buildSystemPrompt } from "./system-prompt";
import { parseAgentTurn } from "./tool-protocol";
import type { ToolRunResult } from "./tools";

export type ChatEmit =
  | { role: "assistant"; content: string }
  | { role: "inline_card"; cardKind: "tool_call"; cardPayload: ToolCallPayload };

export type AgentLlm = (
  args: { system: string; messages: LlmChatMessage[] },
) => Promise<{ ok: true; text: string } | { ok: false; error: string }>;

export type AgentToolRunner = (
  call: { tool: string; input: Record<string, unknown> },
) => Promise<ToolRunResult>;

const DEFAULT_MAX_STEPS = 5;

function toolCard(tool: string, result: ToolRunResult): ChatEmit {
  const payload: ToolCallPayload = {
    tool,
    label: result.label,
    status: result.status,
    summary: result.summary,
    ...(result.detail ? { detail: result.detail } : {}),
    ...(result.openHref ? { openHref: result.openHref } : {}),
  };
  return { role: "inline_card", cardKind: "tool_call", cardPayload: payload };
}

/**
 * Drive the agent for one user turn. Returns the ordered rows the route should append:
 * a tool_call card per fired tool, followed by the assistant's final answer.
 */
export async function runChatAgent(opts: {
  inventory: ChatInventory;
  content: string;
  llm: AgentLlm;
  runTool: AgentToolRunner;
  maxSteps?: number;
}): Promise<ChatEmit[]> {
  const { system } = buildSystemPrompt(opts.inventory);
  const maxSteps = opts.maxSteps ?? DEFAULT_MAX_STEPS;

  const convo: LlmChatMessage[] = [{ role: "user", content: opts.content }];
  const emits: ChatEmit[] = [];

  for (let step = 0; step < maxSteps; step++) {
    const res = await opts.llm({ system, messages: convo });
    if (!res.ok) {
      emits.push({
        role: "assistant",
        content: `I couldn't reach the model just now (${res.error}). Try again in a moment.`,
      });
      return emits;
    }

    const turn = parseAgentTurn(res.text);
    if (turn.kind === "final") {
      emits.push({
        role: "assistant",
        content: turn.text || "I'm here — tell me what you'd like me to do.",
      });
      return emits;
    }

    // Tool call: run it, surface the card, feed the result back for the next turn.
    const result = await opts.runTool(turn.call);
    emits.push(toolCard(turn.call.tool, result));
    convo.push({ role: "assistant", content: res.text });
    convo.push({
      role: "user",
      content: `TOOL_RESULT for ${turn.call.tool}:\n${result.forModel}`,
    });
  }

  // Step budget exhausted without a final answer — close out honestly rather than loop forever.
  emits.push({
    role: "assistant",
    content:
      "I ran several steps but didn't land a final answer. Here's what I gathered above — " +
      "tell me how you'd like me to continue.",
  });
  return emits;
}
