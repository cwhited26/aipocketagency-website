// POST /api/v1/personas/<id>/invoke — invoke one of the user's personas with a message
// and stream the response (SSE). Routed through the BYO LLM dispatcher (lib/llm/dispatch)
// so it honors the user's provider choice with PA-managed fallback. ContainmentGuard is
// scoped to the persona's own knowledge zone. Counts toward persona usage + API usage.

import {
  handleV1,
  handlePreflight,
  v1Json,
  type V1Context,
  type V1HandlerResult,
} from "@/lib/api-v1/context";
import { personaInvokeBodySchema } from "@/lib/api-v1/schemas";
import {
  bumpConversationStats,
  fetchConversation,
  fetchCurrentSpec,
  fetchPersona,
  incrementUsage,
  insertConversation,
  insertMessage,
  listMessages,
} from "@/lib/personas/db";
import { canSendMessage, monthKey } from "@/lib/personas/tier-caps";
import { loadKnowledgeForChat } from "@/lib/personas/knowledge";
import { buildPersonaSystemPrompt, parsePersonaSpecMarkdown } from "@/lib/personas/spec";
import { getDailyLogsForContext } from "@/lib/personas/daily-logs";
import { getPersonaDisplayName } from "@/lib/personas/types";
import {
  loadZoneConfig,
  ContainmentBlockedError,
} from "@/lib/brain/containment-guard";
import { logApiRequest } from "@/lib/api-keys/db";
import { streamLlm } from "@/lib/llm/dispatch";
import type { LlmStreamEvent } from "@/lib/llm/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_HISTORY = 20;

export function OPTIONS(req: Request): Response {
  return handlePreflight(req);
}

export function POST(
  req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  return handleV1(req, (r, ctx) => invokeHandler(r, ctx, params.id));
}

async function ownsConversation(conversationId: string, personaId: string): Promise<boolean> {
  const convo = await fetchConversation(conversationId);
  return Boolean(convo && convo.persona_id === personaId);
}

async function invokeHandler(
  req: Request,
  ctx: V1Context,
  personaId: string,
): Promise<V1HandlerResult> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { response: v1Json({ error: "Invalid JSON" }, 400) };
  }
  const parsed = personaInvokeBodySchema.safeParse(raw);
  if (!parsed.success) {
    return { response: v1Json({ error: parsed.error.message }, 422) };
  }
  const { message, conversationId } = parsed.data;

  const persona = await fetchPersona(personaId);
  // Scope to the API key owner — a key can only invoke its own personas.
  if (!persona || persona.business_id !== ctx.userId) {
    return { response: v1Json({ error: "Persona not found." }, 404) };
  }
  if (persona.status !== "active") {
    return { response: v1Json({ error: `Persona is ${persona.status}, not active.` }, 409) };
  }

  const cap = await canSendMessage(persona.id);
  if (!cap.ok) {
    return { response: v1Json({ error: cap.reason }, 429) };
  }

  if (!ctx.paUser?.brain_repo) {
    return { response: v1Json({ error: "No brain repo connected." }, 503) };
  }
  const { brain_repo, github_token, anthropic_api_key } = ctx.paUser;

  const specRow = await fetchCurrentSpec(persona);
  const specFields = specRow ? parsePersonaSpecMarkdown(specRow.body_md) : {};
  const { config: zoneConfig } = await loadZoneConfig(brain_repo, github_token);

  let knowledge;
  try {
    knowledge = await loadKnowledgeForChat(brain_repo, github_token, persona, zoneConfig, {
      ownerId: persona.business_id,
      query: message,
    });
  } catch (e) {
    if (e instanceof ContainmentBlockedError) {
      return {
        response: v1Json(
          { error: "This persona hit a knowledge configuration issue and was blocked from reading outside its zone." },
          500,
        ),
      };
    }
    throw e;
  }

  // Owner activity context (PA-CTX-1): inject the owner's last-3-days `## Recent activity` block. The
  // invoke API is authenticated as the owner, so this is the owner's own log — best-effort ("" on any
  // failure or before migration 090).
  const recentActivityBlock = await getDailyLogsForContext(persona.business_id, 3);

  const systemPrompt = buildPersonaSystemPrompt({
    personaName: getPersonaDisplayName(persona),
    tone: persona.tone,
    spec: specFields,
    knowledgeMarkup: knowledge.markup,
    hasKnowledge: knowledge.fileCount > 0,
    recentActivityBlock,
  });

  const convoId =
    conversationId && (await ownsConversation(conversationId, persona.id))
      ? conversationId
      : (await insertConversation({ persona_id: persona.id, seat_id: null })).id;

  const prior = await listMessages(convoId);
  const history = prior
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  await insertMessage({ conversation_id: convoId, role: "user", content: message, tokens_used: 0 });

  const dispatch = await streamLlm({
    userId: ctx.userId,
    paManagedKey: anthropic_api_key ?? "",
    system: systemPrompt,
    messages: [...history, { role: "user", content: message }],
    maxTokens: 2048,
  });
  if (!dispatch.ok) {
    return { response: v1Json({ error: dispatch.error }, dispatch.status) };
  }

  const response = streamToSse({
    upstream: dispatch.stream,
    conversationId: convoId,
    personaId: persona.id,
    apiKeyId: ctx.apiKey.id,
    meta: {
      provider: dispatch.provider,
      model: dispatch.model,
      qualityWarning: dispatch.qualityWarning,
      usedFallback: dispatch.usedFallback,
      fallbackReason: dispatch.fallbackReason,
    },
  });
  // The stream persists usage + logs the API request on completion.
  return { response, skipLog: true };
}

type StreamMeta = {
  provider: string;
  model: string;
  qualityWarning: boolean;
  usedFallback: boolean;
  fallbackReason: string | null;
};

// Re-emits the normalized LlmStreamEvent stream as client SSE (`data: {json}` lines),
// accumulating the assistant text + token usage to persist + log on completion.
function streamToSse(args: {
  upstream: ReadableStream<LlmStreamEvent>;
  conversationId: string;
  personaId: string;
  apiKeyId: string;
  meta: StreamMeta;
}): Response {
  const { upstream, conversationId, personaId, apiKeyId, meta } = args;
  const encoder = new TextEncoder();

  const out = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      send({ type: "meta", conversationId, ...meta });

      let assistantText = "";
      let totalTokens = 0;
      const reader = upstream.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value.type === "delta") {
            assistantText += value.text;
            send({ type: "delta", text: value.text });
          } else if (value.type === "usage") {
            totalTokens = value.inputTokens + value.outputTokens;
          } else if (value.type === "error") {
            send({ type: "error", error: value.error });
          }
        }

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
        await logApiRequest({
          api_key_id: apiKeyId,
          endpoint: `/api/v1/personas/${personaId}/invoke`,
          method: "POST",
          status_code: 200,
          tokens_used: totalTokens,
        }).catch(() => undefined);

        send({ type: "done" });
      } catch (e) {
        send({ type: "error", error: e instanceof Error ? e.message : "stream error" });
      } finally {
        controller.close();
      }
    },
    cancel(reason) {
      void upstream.cancel(reason);
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
