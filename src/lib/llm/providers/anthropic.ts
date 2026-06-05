// anthropic.ts — provider adapter for Anthropic's Messages API. Direct fetch to
// https://api.anthropic.com/v1/messages (no SDK, per CLAUDE.md §5.6). Streaming SSE.
// Also backs the PA-managed default provider (same wire format, platform key).

import type {
  AdapterCallParams,
  ListModelsParams,
  ListModelsResult,
  LlmStreamEvent,
  ProviderAdapter,
  StreamOpenResult,
} from "../types";
import { sseToEvents } from "./sse";

const ANTHROPIC_BASE = "https://api.anthropic.com/v1";
const ANTHROPIC_VERSION = "2023-06-01";

type AnthropicSseEvent = {
  type: string;
  delta?: { type?: string; text?: string };
  message?: { usage?: { input_tokens?: number } };
  usage?: { output_tokens?: number };
};

async function streamCompletion(params: AdapterCallParams): Promise<StreamOpenResult> {
  const res = await fetch(`${ANTHROPIC_BASE}/messages`, {
    method: "POST",
    headers: {
      "x-api-key": params.apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: params.model,
      max_tokens: params.maxTokens,
      stream: true,
      system: params.system,
      messages: params.messages,
    }),
    cache: "no-store",
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    return { ok: false, status: res.status, error: text.slice(0, 240) || res.statusText };
  }

  let inputTokens = 0;
  let outputTokens = 0;
  const handle = (data: string, emit: (e: LlmStreamEvent) => void): void => {
    let evt: AnthropicSseEvent;
    try {
      evt = JSON.parse(data) as AnthropicSseEvent;
    } catch {
      return;
    }
    if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta" && evt.delta.text) {
      emit({ type: "delta", text: evt.delta.text });
    } else if (evt.type === "message_start" && evt.message?.usage?.input_tokens) {
      inputTokens = evt.message.usage.input_tokens;
    } else if (evt.type === "message_delta" && evt.usage?.output_tokens) {
      outputTokens = evt.usage.output_tokens;
      emit({ type: "usage", inputTokens, outputTokens });
    }
  };

  return { ok: true, stream: sseToEvents(res.body, handle) };
}

type AnthropicModelsResponse = { data?: Array<{ id?: string }> };

async function listModels(params: ListModelsParams): Promise<ListModelsResult> {
  const res = await fetch(`${ANTHROPIC_BASE}/models?limit=100`, {
    headers: {
      "x-api-key": params.apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, status: res.status, error: text.slice(0, 240) || res.statusText };
  }
  const body = (await res.json()) as AnthropicModelsResponse;
  const models = (body.data ?? [])
    .map((m) => m.id)
    .filter((id): id is string => typeof id === "string");
  return { ok: true, models };
}

export const anthropicAdapter: ProviderAdapter = { streamCompletion, listModels };
