// computer-use.ts — the direct-REST Anthropic Computer Use call (no SDK, repo rule) plus the
// conversation plumbing: initial messages, tool_result appends, and screenshot pruning so the
// jsonb state stays small across a 50-step job.
//
// Tool set: the Anthropic-defined computer_20250124 (coordinate actions against the Browserbase
// viewport) + a custom `navigate` tool ({url}) so the model jumps pages in one gated action
// instead of pantomiming the address bar. bash_20250124 is deliberately absent — there is no
// shell behind a hosted browser session, and offering one would invite dead-end tool calls.

import {
  BROWSER_AGENT_MODEL,
  BROWSER_VIEWPORT,
  COMPUTER_USE_BETA_HEADER,
  CONVERSATION_SCREENSHOTS_KEPT,
} from "./constants";
import type {
  AnthropicContentBlock,
  AnthropicImageSource,
  AnthropicMessage,
  AnthropicUsage,
  ComputerAction,
  PlannedAction,
} from "./types";
import { ComputerActionSchema, NavigateInputSchema } from "./types";

export type ComputerUseResult =
  | {
      ok: true;
      content: AnthropicContentBlock[];
      stopReason: string;
      usage: AnthropicUsage;
    }
  | { ok: false; error: string };

const SYSTEM_PROMPT = [
  "You are Pocket Agent's Browser Agent. You operate a real hosted browser one action at a time to complete the owner's task.",
  "",
  "Rules:",
  "- Work only toward the stated task. Do not wander to unrelated sites.",
  "- Take a screenshot when you need to see the current state before acting.",
  "- Use the navigate tool to change pages instead of typing into the address bar.",
  "- NEVER enter usernames, passwords, or verification codes. If a page demands sign-in you cannot get past, stop and report that the owner must log in or provide access another way.",
  "- Some actions (form submissions, purchases, deletions, new domains) pause for the owner's approval. If a tool result says the owner rejected an action, do not retry it — find another way or wrap up.",
  "- When the task is complete (or cannot proceed), reply with plain text only: a short factual summary of what happened and what, if anything, the owner should do next. No tool call means you are done.",
].join("\n");

export function buildInitialMessages(params: {
  intent: string;
  startingUrl: string;
  firstScreenshotBase64: string;
}): AnthropicMessage[] {
  return [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `Task: ${params.intent}\n\nThe browser is open at ${params.startingUrl}. Here is the current page:`,
        },
        { type: "image", source: pngSource(params.firstScreenshotBase64) },
      ],
    },
  ];
}

export function pngSource(base64: string): AnthropicImageSource {
  return { type: "base64", media_type: "image/png", data: base64 };
}

/** One planning call. The caller owns the conversation and appends the returned content. */
export async function callComputerUse(params: {
  apiKey: string;
  messages: AnthropicMessage[];
}): Promise<ComputerUseResult> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": params.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": COMPUTER_USE_BETA_HEADER,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: BROWSER_AGENT_MODEL,
      max_tokens: 1_500,
      system: SYSTEM_PROMPT,
      tools: [
        {
          type: "computer_20250124",
          name: "computer",
          display_width_px: BROWSER_VIEWPORT.width,
          display_height_px: BROWSER_VIEWPORT.height,
        },
        {
          name: "navigate",
          description:
            "Navigate the browser to a URL. Use this instead of typing into the address bar. Navigating to a different domain pauses for the owner's approval.",
          input_schema: {
            type: "object",
            properties: {
              url: { type: "string", description: "The absolute http(s) URL to open." },
            },
            required: ["url"],
            additionalProperties: false,
          },
        },
      ],
      messages: params.messages,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, error: `Anthropic ${res.status}: ${body.slice(0, 400)}` };
  }
  const data = (await res.json()) as {
    content?: AnthropicContentBlock[];
    stop_reason?: string;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  return {
    ok: true,
    content: Array.isArray(data.content) ? data.content : [],
    stopReason: data.stop_reason ?? "end_turn",
    usage: {
      input_tokens: data.usage?.input_tokens ?? 0,
      output_tokens: data.usage?.output_tokens ?? 0,
    },
  };
}

/**
 * Normalizes a tool_use block into a PlannedAction the driver + approval gate consume.
 * Unknown / unsupported actions return an error string the worker sends back as an is_error
 * tool_result — the model course-corrects instead of the job dying.
 */
export function planFromToolUse(
  name: string,
  input: Record<string, unknown>,
): { ok: true; action: PlannedAction } | { ok: false; error: string } {
  if (name === "navigate") {
    const parsed = NavigateInputSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "navigate needs a valid absolute URL." };
    return { ok: true, action: { kind: "navigate", url: parsed.data.url } };
  }
  if (name !== "computer") return { ok: false, error: `Unknown tool "${name}".` };

  const parsed = ComputerActionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const a: ComputerAction = parsed.data;

  const coord = (): { x: number; y: number } | null =>
    a.coordinate ? { x: Math.round(a.coordinate[0]), y: Math.round(a.coordinate[1]) } : null;

  switch (a.action) {
    case "screenshot":
    case "cursor_position":
      return { ok: true, action: { kind: "screenshot" } };
    case "left_click": {
      const c = coord();
      if (!c) return { ok: false, error: "left_click needs a coordinate." };
      return { ok: true, action: { kind: "click", ...c, clickCount: 1, button: "left" } };
    }
    case "double_click": {
      const c = coord();
      if (!c) return { ok: false, error: "double_click needs a coordinate." };
      return { ok: true, action: { kind: "click", ...c, clickCount: 2, button: "left" } };
    }
    case "triple_click": {
      const c = coord();
      if (!c) return { ok: false, error: "triple_click needs a coordinate." };
      return { ok: true, action: { kind: "click", ...c, clickCount: 3, button: "left" } };
    }
    case "right_click": {
      const c = coord();
      if (!c) return { ok: false, error: "right_click needs a coordinate." };
      return { ok: true, action: { kind: "click", ...c, clickCount: 1, button: "right" } };
    }
    case "type":
      if (!a.text) return { ok: false, error: "type needs text." };
      return { ok: true, action: { kind: "type", text: a.text } };
    case "key":
      if (!a.text) return { ok: false, error: "key needs a key name." };
      return { ok: true, action: { kind: "key", text: a.text } };
    case "scroll": {
      const c = coord() ?? { x: BROWSER_VIEWPORT.width / 2, y: BROWSER_VIEWPORT.height / 2 };
      return {
        ok: true,
        action: {
          kind: "scroll",
          ...c,
          direction: a.scroll_direction ?? "down",
          amount: a.scroll_amount ?? 3,
        },
      };
    }
    case "wait":
      return { ok: true, action: { kind: "wait", seconds: a.duration ?? 1 } };
    default:
      return {
        ok: false,
        error: `Action "${a.action}" is not supported in this hosted browser session. Supported: screenshot, left_click, double_click, triple_click, right_click, type, key, scroll, wait, navigate.`,
      };
  }
}

/** tool_result carrying the post-action screenshot (the Computer Use feedback loop). */
export function toolResultWithScreenshot(params: {
  toolUseId: string;
  note: string;
  screenshotBase64: string;
}): AnthropicContentBlock {
  return {
    type: "tool_result",
    tool_use_id: params.toolUseId,
    content: [
      { type: "text", text: params.note },
      { type: "image", source: pngSource(params.screenshotBase64) },
    ],
  };
}

export function toolResultError(toolUseId: string, message: string): AnthropicContentBlock {
  return {
    type: "tool_result",
    tool_use_id: toolUseId,
    is_error: true,
    content: [{ type: "text", text: message }],
  };
}

/**
 * Keeps the persisted conversation small: only the most recent N screenshots survive as
 * images; older ones collapse to a text stub. Anthropic recommends pruning stale screenshots,
 * and the jsonb state column shouldn't carry megabytes of stale pixels.
 */
export function pruneOldScreenshots(
  messages: AnthropicMessage[],
  keep: number = CONVERSATION_SCREENSHOTS_KEPT,
): AnthropicMessage[] {
  let seen = 0;
  const out: AnthropicMessage[] = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const content = msg.content.map((block): AnthropicContentBlock => {
      if (block.type === "image") {
        seen += 1;
        return seen <= keep ? block : { type: "text", text: "[earlier screenshot removed]" };
      }
      if (block.type === "tool_result") {
        return {
          ...block,
          content: block.content.map((inner) => {
            if (inner.type === "image") {
              seen += 1;
              return seen <= keep
                ? inner
                : { type: "text" as const, text: "[earlier screenshot removed]" };
            }
            return inner;
          }),
        };
      }
      return block;
    });
    out.unshift({ role: msg.role, content });
  }
  return out;
}
