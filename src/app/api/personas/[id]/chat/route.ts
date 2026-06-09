import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchPaUser } from "@/lib/pa-supabase";
import {
  bumpConversationStats,
  fetchConversation,
  fetchCurrentSpec,
  fetchPersona,
  fetchShareToken,
  incrementUsage,
  insertConversation,
  insertMessage,
  listMessages,
  PersonaDbError,
} from "@/lib/personas/db";
import { canSendMessage, monthKey } from "@/lib/personas/tier-caps";
import { isTokenLive } from "@/lib/personas/tokens";
import { loadKnowledgeForChat } from "@/lib/personas/knowledge";
import { buildPersonaSystemPrompt, parsePersonaSpecMarkdown } from "@/lib/personas/spec";
import { loadZoneConfig } from "@/lib/brain/containment-guard";
import { ContainmentBlockedError } from "@/lib/brain/containment-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Params = { params: { id: string } };

const bodySchema = z.object({
  token: z.string().min(10).max(200),
  message: z.string().min(1).max(8_000),
  conversationId: z.string().uuid().optional(),
});

const MAX_HISTORY = 20;

export async function POST(req: Request, { params }: Params): Promise<Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 422 });
  }
  const { token, message, conversationId } = parsed.data;

  try {
    // 1. Validate the share token and bind it to this persona.
    const tokenRow = await fetchShareToken(token);
    if (!tokenRow || !isTokenLive(tokenRow) || tokenRow.persona_id !== params.id) {
      return NextResponse.json({ error: "This link is no longer valid." }, { status: 401 });
    }

    const persona = await fetchPersona(params.id);
    if (!persona) return NextResponse.json({ error: "Persona not found." }, { status: 404 });
    if (persona.status !== "active") {
      return NextResponse.json(
        {
          capped: true,
          assistant:
            persona.status === "paused"
              ? "This assistant is paused right now. Please check back later."
              : "This assistant isn't available.",
        },
        { status: 200 },
      );
    }

    // 2. Tier cap (messages/persona/month).
    const cap = await canSendMessage(persona.id);
    if (!cap.ok) {
      return NextResponse.json({ capped: true, assistant: cap.reason }, { status: 200 });
    }

    // 3. Resolve the owner's brain context (service-role; no team-member session).
    const ownerRes = await fetchPaUser(persona.business_id);
    if (!ownerRes.ok || !ownerRes.data?.brain_repo) {
      return NextResponse.json({ error: "This assistant isn't configured yet." }, { status: 503 });
    }
    const { brain_repo, github_token, anthropic_api_key } = ownerRes.data;
    if (!anthropic_api_key) {
      return NextResponse.json(
        { error: "This assistant isn't configured yet (no model key)." },
        { status: 503 },
      );
    }

    // 4. Load the authoritative spec + zone-scoped knowledge (ContainmentGuard).
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
        // A read escaped the persona's zone — record it and refuse rather than leak.
        const convo =
          conversationId && (await ownsConversation(conversationId, persona.id))
            ? conversationId
            : (await insertConversation({ persona_id: persona.id, seat_id: tokenRow.seat_id })).id;
        await insertMessage({
          conversation_id: convo,
          role: "system",
          content: `Containment block: ${e.message}`,
          tokens_used: 0,
          blocked_by_containment: true,
        });
        return NextResponse.json(
          { error: "This assistant hit a knowledge configuration issue. The owner has been notified." },
          { status: 500 },
        );
      }
      throw e;
    }

    const systemPrompt = buildPersonaSystemPrompt({
      personaName: persona.name,
      tone: persona.tone,
      spec: specFields,
      knowledgeMarkup: knowledge.markup,
      hasKnowledge: knowledge.fileCount > 0,
    });

    // 5. Conversation + history.
    const convoId =
      conversationId && (await ownsConversation(conversationId, persona.id))
        ? conversationId
        : (await insertConversation({ persona_id: persona.id, seat_id: tokenRow.seat_id })).id;

    const prior = await listMessages(convoId);
    const history = prior
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-MAX_HISTORY)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    await insertMessage({ conversation_id: convoId, role: "user", content: message, tokens_used: 0 });

    // 6. Open the model stream (default model, fallback on hard failure).
    const messages = [...history, { role: "user" as const, content: message }];
    const upstream = await openStream(anthropic_api_key, systemPrompt, messages);
    if (!upstream.ok) {
      return NextResponse.json({ error: upstream.error }, { status: 502 });
    }

    return streamResponse({
      upstream: upstream.body,
      conversationId: convoId,
      personaId: persona.id,
    });
  } catch (e) {
    const status = e instanceof PersonaDbError ? e.status : 500;
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unexpected error" },
      { status },
    );
  }
}

async function ownsConversation(conversationId: string, personaId: string): Promise<boolean> {
  const convo = await fetchConversation(conversationId);
  return Boolean(convo && convo.persona_id === personaId);
}

// ── Anthropic streaming ───────────────────────────────────────────────────────────────

type StreamOpen =
  | { ok: true; body: ReadableStream<Uint8Array> }
  | { ok: false; error: string };

async function openStream(
  apiKey: string,
  system: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<StreamOpen> {
  const primary = process.env.PA_PERSONAS_DEFAULT_MODEL ?? "claude-sonnet-4-6";
  const fallback = process.env.PA_PERSONAS_FALLBACK_MODEL ?? null;

  const attempt = async (model: string): Promise<Response> =>
    fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({ model, max_tokens: 2048, stream: true, system, messages }),
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

// Proxies the Anthropic SSE stream to the client as simple `data: {json}` lines, while
// accumulating the full assistant text + token usage to persist on completion.
function streamResponse(args: {
  upstream: ReadableStream<Uint8Array>;
  conversationId: string;
  personaId: string;
}): Response {
  const { upstream, conversationId, personaId } = args;
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
        // Billable unit = one user turn. Tokens count input+output.
        await incrementUsage(personaId, monthKey(), { messages: 1, tokens: totalTokens });

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
