// chat-stream.ts — shared Anthropic streaming for persona chat surfaces. Mode A (Wave 1)
// has its own inline copy in the team chat route; the Wave 2 public + widget route reuses
// THIS module so the public surface and the team surface stay behavior-identical (same
// model selection, same SSE shape, same persistence). Extracted to avoid drift between
// the two anonymous-chat code paths the adversarial brief tests.

import {
  bumpConversationStats,
  fetchConversation,
  incrementUsage,
  insertMessage,
} from "./db";
import { monthKey } from "./tier-caps";

export type StreamOpen =
  | { ok: true; body: ReadableStream<Uint8Array> }
  | { ok: false; error: string };

/** Opens the upstream Anthropic SSE stream, falling back to the secondary model once. */
export async function openModelStream(
  apiKey: string,
  system: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  maxTokens = 2048,
): Promise<StreamOpen> {
  const primary = process.env.PA_PERSONAS_DEFAULT_MODEL ?? "claude-sonnet-4-6";
  const fallback = process.env.PA_PERSONAS_FALLBACK_MODEL ?? null;

  const attempt = (model: string): Promise<Response> =>
    fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({ model, max_tokens: maxTokens, stream: true, system, messages }),
      cache: "no-store",
    });

  let res = await attempt(primary);
  if (!res.ok && fallback) res = await attempt(fallback);
  if (!res.ok || !res.body) {
    const t = await res.text().catch(() => "");
    return { ok: false, error: `Model error (${res.status}): ${t.slice(0, 160)}` };
  }
  return { ok: true, body: res.body };
}

type AnthropicEvent = {
  type: string;
  delta?: { type?: string; text?: string };
  message?: { usage?: { input_tokens?: number } };
  usage?: { output_tokens?: number };
};

export type TurnCompleteInfo = { totalTokens: number };

/**
 * Proxies the upstream SSE to the client as `data: {json}` lines while accumulating the
 * full assistant text + token usage to persist on completion. `onTurnComplete` runs after
 * the message + usage are persisted (the public route uses it to fire monthly-cap
 * notifications). Failures in the callback are swallowed — they must never break the
 * already-streamed response.
 */
export function streamPersonaResponse(args: {
  upstream: ReadableStream<Uint8Array>;
  conversationId: string;
  personaId: string;
  onTurnComplete?: (info: TurnCompleteInfo) => Promise<void>;
}): Response {
  const { upstream, conversationId, personaId, onTurnComplete } = args;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const out = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      send({ type: "meta", conversationId });

      let assistantText = "";
      let inputTokens = 0;
      let outputTokens = 0;
      let buffer = "";
      const reader = upstream.getReader();

      const handleEvent = (jsonStr: string) => {
        let evt: AnthropicEvent;
        try {
          evt = JSON.parse(jsonStr) as AnthropicEvent;
        } catch {
          return;
        }
        if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta" && evt.delta.text) {
          assistantText += evt.delta.text;
          send({ type: "delta", text: evt.delta.text });
        } else if (evt.type === "message_start" && evt.message?.usage?.input_tokens) {
          inputTokens = evt.message.usage.input_tokens;
        } else if (evt.type === "message_delta" && evt.usage?.output_tokens) {
          outputTokens = evt.usage.output_tokens;
        }
      };

      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n");
          buffer = parts.pop() ?? "";
          for (const line of parts) {
            const trimmed = line.trim();
            if (trimmed.startsWith("data:")) handleEvent(trimmed.slice(5).trim());
          }
        }

        const totalTokens = inputTokens + outputTokens;
        await insertMessage({
          conversation_id: conversationId,
          role: "assistant",
          content: assistantText,
          tokens_used: totalTokens,
        });
        const convo = await fetchConversation(conversationId);
        if (convo) {
          await bumpConversationStats(
            conversationId,
            { messages: 2, tokens: totalTokens },
            { message_count: convo.message_count, token_cost_total: convo.token_cost_total },
          );
        }
        await incrementUsage(personaId, monthKey(), { messages: 1, tokens: totalTokens });
        if (onTurnComplete) {
          try {
            await onTurnComplete({ totalTokens });
          } catch {
            /* never break the streamed response on a post-turn hook failure */
          }
        }

        send({ type: "done" });
      } catch (e) {
        send({ type: "error", error: e instanceof Error ? e.message : "stream error" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(out, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
