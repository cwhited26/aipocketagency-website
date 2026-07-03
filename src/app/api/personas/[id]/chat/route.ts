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
import { canSendMessage, getCurrentTier, monthKey, type Tier } from "@/lib/personas/tier-caps";
import { isTokenLive } from "@/lib/personas/tokens";
import { loadKnowledgeForChat } from "@/lib/personas/knowledge";
import { buildPersonaSystemPrompt, parsePersonaSpecMarkdown } from "@/lib/personas/spec";
import { buildSmartContext, type ContextMessage } from "@/lib/personas/build-smart-context";
import { getDailyLogsForContext } from "@/lib/personas/daily-logs";
import { getPersonaDisplayName, isPublicMode } from "@/lib/personas/types";
import { loadPersonaMemory } from "@/lib/persona-memory/read";
import { runMemoryLearnPhase, defaultMemoryLearnLlm } from "@/lib/persona-memory/write";
import { loadPersonaSoul } from "@/lib/personas/soul-load";
import { runSignalCatcherForMessage } from "@/lib/signal-catcher/catch";
import { signalCatcherLog } from "@/lib/signal-catcher/log";
import type { PersonaRow } from "@/lib/personas/types";
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
// How far back the smart-context blender looks. Turns older than the recent MAX_HISTORY get rolled
// into summaries / relevance instead of being dropped entirely (PA-CTX-3).
const SMART_CONTEXT_WINDOW = 60;

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

    // Persona memory (PA-MEM-4): cascade-ranked, ~2k-token block stitched into the prompt. Additive to
    // the brain RAG above; never reads in public mode (loadPersonaMemory hard-guards on persona.mode).
    const memory = await loadPersonaMemory({ personaId: persona.id, mode: persona.mode });

    // Persona Soul (Soul System SPEC): the `## How [Owner] prefers to be worked with` block — HOW to
    // work with this owner (style, preferences, boundaries). Additive to memory; never reads in public
    // mode (loadPersonaSoul hard-guards on persona.mode).
    const soul = await loadPersonaSoul({ personaId: persona.id, mode: persona.mode });

    // Resolved once for the LEARN-phase cap check after the turn completes.
    const tier = await getCurrentTier(persona.business_id);

    // 5. Conversation + history. Load prior turns BEFORE the prompt so the smart-context blender can
    // summarize older ranges + pull in relevant earlier turns (PA-CTX-3).
    const convoId =
      conversationId && (await ownsConversation(conversationId, persona.id))
        ? conversationId
        : (await insertConversation({ persona_id: persona.id, seat_id: tokenRow.seat_id })).id;

    const prior = await listMessages(convoId);
    const priorTurns: ContextMessage[] = prior
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-SMART_CONTEXT_WINDOW)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    // Owner activity (PA-CTX-1) + smart context (PA-CTX-3). Both are owner-private, so they never load
    // in public mode — same guard the memory cascade uses. The composed promptBlock already embeds the
    // daily-log `## Recent activity` block, so it's the single context block stitched into the prompt.
    const dailyLogsBlock = isPublicMode(persona.mode)
      ? ""
      : await getDailyLogsForContext(persona.business_id, 3);
    const smart = await buildSmartContext(priorTurns, message, {
      recentN: MAX_HISTORY,
      dailyLogsBlock,
      summarize: makeRangeSummarizer(anthropic_api_key),
      maxRanges: 2,
    });

    const systemPrompt = buildPersonaSystemPrompt({
      personaName: getPersonaDisplayName(persona),
      tone: persona.tone,
      spec: specFields,
      knowledgeMarkup: knowledge.markup,
      hasKnowledge: knowledge.fileCount > 0,
      memoryBlock: memory.block,
      recentActivityBlock: smart.promptBlock,
      soulBlock: soul.block,
    });

    const userMessageRow = await insertMessage({
      conversation_id: convoId,
      role: "user",
      content: message,
      tokens_used: 0,
    });

    // 6. Open the model stream (default model, fallback on hard failure). Recent turns flow verbatim;
    // older context rides in the system prompt via smart.promptBlock above.
    const messages = [...smart.recentMessages, { role: "user" as const, content: message }];
    const upstream = await openStream(anthropic_api_key, systemPrompt, messages);
    if (!upstream.ok) {
      return NextResponse.json({ error: upstream.error }, { status: 502 });
    }

    return streamResponse({
      upstream: upstream.body,
      conversationId: convoId,
      personaId: persona.id,
      learn: { persona, tier, userMessage: message },
      signal: { apiKey: anthropic_api_key, userMessageId: userMessageRow.id },
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

// ── Rolling-summary helper for the smart-context blender ────────────────────────────────
//
// One non-streaming Anthropic call that condenses an older message range into 1–2 sentences. Best
// effort: any failure throws so buildSmartContext falls back to its deterministic extractive digest.
// Only fires when a conversation has older ranges (long threads), so most turns never call it.
function makeRangeSummarizer(apiKey: string) {
  return async (messages: ContextMessage[]): Promise<string> => {
    const model = process.env.PA_PERSONAS_SUMMARY_MODEL ?? "claude-haiku-4-5-20251001";
    const transcript = messages
      .map((m) => `${m.role === "user" ? "Them" : "Agent"}: ${m.content}`)
      .join("\n");
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 160,
        system:
          "Summarize this slice of an ongoing conversation in 1–2 sentences. Capture decisions, " +
          "facts, and open threads. No preamble — just the summary.",
        messages: [{ role: "user", content: transcript }],
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`summary model error ${res.status}`);
    }
    const data: unknown = await res.json();
    const blocks =
      data && typeof data === "object" && Array.isArray((data as { content?: unknown }).content)
        ? ((data as { content: Array<{ type?: string; text?: string }> }).content)
        : [];
    const text = blocks
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text as string)
      .join(" ")
      .trim();
    if (!text) throw new Error("summary model returned no text");
    return text;
  };
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
  // LEARN-phase context (PA-MEM-3): after the turn completes, classify it for memory writes. Optional
  // so the streaming helper stays usable without it.
  learn: { persona: PersonaRow; tier: Tier; userMessage: string };
  // Signal Catcher context (PA-SIGNAL-1): after the turn completes, read the owner's message for a
  // standing wish worth proposing as a Ritual. Same post-stream slot as LEARN — never blocks the reply.
  signal: { apiKey: string; userMessageId: string };
}): Response {
  const { upstream, conversationId, personaId, learn, signal } = args;
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

        // LEARN phase (PA-MEM-3): the turn is fully streamed + persisted — now decide whether anything
        // is worth remembering. Best-effort: a LEARN error never fails the completed turn. Public mode
        // is guarded inside runMemoryLearnPhase.
        try {
          await runMemoryLearnPhase({
            persona: learn.persona,
            tier: learn.tier,
            conversationId,
            userMessage: learn.userMessage,
            assistantText,
            origin: "conversation",
            llm: defaultMemoryLearnLlm(learn.persona.business_id),
          });
        } catch {
          // swallowed by design — the turn already succeeded.
        }

        // Signal Catcher (PA-SIGNAL-1): the turn is done — now read the owner's message for a
        // standing wish. Best-effort with a logged reason: a catch failure never fails the turn.
        try {
          await runSignalCatcherForMessage({
            ownerId: learn.persona.business_id,
            tier: learn.tier,
            personaMode: learn.persona.mode,
            apiKey: signal.apiKey,
            conversationId,
            userMessageId: signal.userMessageId,
            costAnchor: signal.userMessageId,
            message: learn.userMessage,
          });
        } catch (e) {
          signalCatcherLog.warn("signal catch failed after a completed turn", {
            conversationId,
            error: e instanceof Error ? e.message : String(e),
          });
        }
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
