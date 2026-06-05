// openai-compatible.ts — shared adapter factory for every OpenAI-Chat-Completions-API
// compatible endpoint. OpenAI, Groq, and the generic custom endpoint all speak the
// identical wire protocol, so they all build on this. Direct fetch (no SDK). Streaming
// SSE with `stream_options.include_usage` so we get a final usage chunk.

import type {
  AdapterCallParams,
  ListModelsParams,
  ListModelsResult,
  LlmChatMessage,
  LlmStreamEvent,
  ProviderAdapter,
  StreamOpenResult,
} from "../types";
import { sseToEvents } from "./sse";

type OpenAiChunk = {
  choices?: Array<{ delta?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

type OpenAiModelsResponse = { data?: Array<{ id?: string }> };

// OpenAI-style APIs fold the system prompt into the messages array as a `system` role.
function toOpenAiMessages(system: string, messages: LlmChatMessage[]) {
  const out: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];
  if (system.trim()) out.push({ role: "system", content: system });
  for (const m of messages) out.push({ role: m.role, content: m.content });
  return out;
}

function trimBase(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

/**
 * Builds a ProviderAdapter for an OpenAI-compatible base URL. When `fixedBaseUrl` is
 * given (OpenAI, Groq) it is always used; when omitted (custom endpoint) each call must
 * supply `endpointUrl`.
 */
export function makeOpenAiCompatibleAdapter(fixedBaseUrl?: string): ProviderAdapter {
  const resolveBase = (endpointUrl?: string): string | null => {
    const base = fixedBaseUrl ?? endpointUrl;
    return base ? trimBase(base) : null;
  };

  async function streamCompletion(params: AdapterCallParams): Promise<StreamOpenResult> {
    const base = resolveBase(params.endpointUrl);
    if (!base) {
      return { ok: false, status: 400, error: "Missing custom endpoint URL." };
    }
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: params.model,
        max_tokens: params.maxTokens,
        stream: true,
        stream_options: { include_usage: true },
        messages: toOpenAiMessages(params.system, params.messages),
      }),
      cache: "no-store",
    });

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      return { ok: false, status: res.status, error: text.slice(0, 240) || res.statusText };
    }

    const handle = (data: string, emit: (e: LlmStreamEvent) => void): void => {
      if (data === "[DONE]") return; // terminal sentinel; `done` is emitted by sseToEvents
      let chunk: OpenAiChunk;
      try {
        chunk = JSON.parse(data) as OpenAiChunk;
      } catch {
        return;
      }
      const text = chunk.choices?.[0]?.delta?.content;
      if (text) emit({ type: "delta", text });
      if (chunk.usage) {
        emit({
          type: "usage",
          inputTokens: chunk.usage.prompt_tokens ?? 0,
          outputTokens: chunk.usage.completion_tokens ?? 0,
        });
      }
    };

    return { ok: true, stream: sseToEvents(res.body, handle) };
  }

  async function listModels(params: ListModelsParams): Promise<ListModelsResult> {
    const base = resolveBase(params.endpointUrl);
    if (!base) return { ok: false, status: 400, error: "Missing custom endpoint URL." };
    const res = await fetch(`${base}/models`, {
      headers: { Authorization: `Bearer ${params.apiKey}` },
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, status: res.status, error: text.slice(0, 240) || res.statusText };
    }
    const body = (await res.json()) as OpenAiModelsResponse;
    const models = (body.data ?? [])
      .map((m) => m.id)
      .filter((id): id is string => typeof id === "string");
    return { ok: true, models };
  }

  return { streamCompletion, listModels };
}
