// public-chat — the anonymous chat endpoint for Mode B (public link) + Mode C (widget).
// Behind the PA_PERSONAS_PUBLIC_MODES_ENABLED flag. Defense order matters and is the
// subject of the adversarial brief (§3): feature flag → token validity + mode →
// widget-origin allowlist → rate limits → monthly cap → abuse-defense screen (BEFORE the
// LLM) → lead capture → ContainmentGuard-bounded knowledge → model stream.

import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchPaUser } from "@/lib/pa-supabase";
import {
  fetchConversation,
  fetchCurrentSpec,
  fetchOwnerEmail,
  fetchPersona,
  fetchShareToken,
  fetchUsageMonthly,
  fetchWidgetConfig,
  insertConversation,
  insertLead,
  insertMessage,
  listMessages,
  markCapNotified,
  PersonaDbError,
} from "@/lib/personas/db";
import { canSendMessage, getCurrentTier, monthKey, TIER_LIMITS } from "@/lib/personas/tier-caps";
import { isTokenLive } from "@/lib/personas/tokens";
import { loadKnowledgeForChat } from "@/lib/personas/knowledge";
import { buildPersonaSystemPrompt, parsePersonaSpecMarkdown } from "@/lib/personas/spec";
import { loadZoneConfig, ContainmentBlockedError } from "@/lib/brain/containment-guard";
import { comingSoon503, publicModesEnabled } from "@/lib/personas/feature-flags";
import { isPublicMode } from "@/lib/personas/types";
import { enforceRateLimits, recordBlockedHit } from "@/lib/personas/rate-limit";
import {
  BLOCKED_ALERT_THRESHOLD_PER_HOUR,
  buildBlockedResponse,
  offTopicRedirector,
  screenForInjection,
} from "@/lib/personas/abuse-defense";
import { extractLeadFromText, hasLeadSignal } from "@/lib/personas/leads";
import { preChatLeadSchema } from "@/lib/personas/types";
import { notifyAbuseSpike, notifyCapThreshold, routeLeadToInbox } from "@/lib/personas/notify";
import { isOriginAllowed, normalizeOrigin } from "@/lib/personas/widget";
import { openModelStream, streamPersonaResponse } from "@/lib/personas/chat-stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Params = { params: { id: string } };

const bodySchema = z.object({
  token: z.string().min(10).max(200),
  message: z.string().min(1).max(4_000), // tighter cap than Mode A — anonymous DoS surface
  conversationId: z.string().uuid().optional(),
  sessionId: z.string().min(8).max(100).optional(),
  // Pre-chat form payload, sent with the first message only (SPEC v3 §9 Mode B).
  lead: preChatLeadSchema.optional(),
});

const MAX_HISTORY = 20;

function clientIp(req: Request): string {
  // Vercel sets x-real-ip from its proxy (harder to spoof than a client-prepended
  // x-forwarded-for entry); fall back to the first forwarded hop.
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";
  return "unknown";
}

function selfOrigins(): string[] {
  return [
    process.env.PA_PERSONAS_PUBLIC_BASE_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    "https://aipocketagent.com",
  ]
    .map((o) => (o ? normalizeOrigin(o) : null))
    .filter((o): o is string => o !== null);
}

export async function POST(req: Request, { params }: Params): Promise<Response> {
  if (!publicModesEnabled()) return comingSoon503();

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
    // 1. Token validity + public mode binding.
    const tokenRow = await fetchShareToken(token);
    if (
      !tokenRow ||
      !isTokenLive(tokenRow) ||
      tokenRow.persona_id !== params.id ||
      !isPublicMode(tokenRow.mode)
    ) {
      return NextResponse.json({ error: "This link is no longer valid." }, { status: 401 });
    }

    const persona = await fetchPersona(params.id);
    if (!persona) return NextResponse.json({ error: "Not found." }, { status: 404 });
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

    const widgetConfig = await fetchWidgetConfig(persona.id);

    // 2. Widget mode: enforce the domain allowlist server-side (Adversarial Brief §3(h)).
    // The legit chat fetch comes from our own embed iframe (same-origin), so our own app
    // origin is always allowed; any OTHER origin must be on the per-widget allowlist. A
    // missing/null origin on a widget token is rejected — that's the direct-API-call
    // vector. (Mode B public links are open by design and skip this check.)
    if (tokenRow.mode === "widget") {
      const origin = req.headers.get("origin");
      const allow = [...selfOrigins(), ...(widgetConfig?.allowed_origins ?? [])];
      if (!isOriginAllowed(origin, allow)) {
        return NextResponse.json(
          { error: "This widget is not authorized for this domain." },
          { status: 403 },
        );
      }
    }

    // 3. Rate limits (per IP/hour, per session/day, per persona/day) — enforced atomically.
    const sessionId = parsed.data.sessionId ?? `anon-${clientIp(req)}`;
    const rate = await enforceRateLimits({
      personaId: persona.id,
      ip: clientIp(req),
      sessionId,
    });
    if (!rate.ok) {
      return NextResponse.json(
        {
          capped: true,
          assistant:
            "You've sent a lot of messages in a short time. Please wait a bit and try again.",
        },
        { status: 429, headers: { "Retry-After": "3600" } },
      );
    }

    // 4. Monthly usage cap. At 100% the public surface shows a templated pause message.
    const cap = await canSendMessage(persona.id);
    if (!cap.ok) {
      const ownerEmail = await fetchOwnerEmail(persona.business_id);
      return NextResponse.json(
        {
          capped: true,
          assistant: ownerEmail
            ? `Thanks for reaching out! We've hit our monthly chat limit, so this assistant is paused for the rest of the month. Please email us at ${ownerEmail} and we'll get right back to you.`
            : "Thanks for reaching out! We've hit our monthly chat limit, so this assistant is paused for the rest of the month. Please check back next month.",
        },
        { status: 200 },
      );
    }

    // 5. Abuse-defense screen — runs BEFORE any model call. Blocked input is logged with
    // blocked_by_containment=true and never reaches the LLM.
    const screen = screenForInjection(message);
    if (screen.blocked) {
      const ownerEmail = await fetchOwnerEmail(persona.business_id);
      const convoId = await ensureConversation(conversationId, persona.id);
      await insertMessage({ conversation_id: convoId, role: "user", content: message, tokens_used: 0 });
      await insertMessage({
        conversation_id: convoId,
        role: "system",
        content: `Blocked input (${screen.pattern.category}:${screen.pattern.id})`,
        tokens_used: 0,
        blocked_by_containment: true,
      });

      // Alert the owner once when blocks spike past the hourly threshold (attack signal).
      const blockedCount = await recordBlockedHit(persona.id);
      if (blockedCount === BLOCKED_ALERT_THRESHOLD_PER_HOUR + 1) {
        await notifyAbuseSpike({ persona, ownerEmail, blockedThisHour: blockedCount }).catch(() => {});
      }

      const redirector = offTopicRedirector({
        override: widgetConfig?.off_topic_message ?? null,
        personaRole: persona.name,
        ownerEmail,
      });
      return NextResponse.json(
        { assistant: buildBlockedResponse(redirector), conversationId: convoId, blocked: true },
        { status: 200 },
      );
    }

    // 6. Owner brain context (service-role; no visitor session).
    const ownerRes = await fetchPaUser(persona.business_id);
    if (!ownerRes.ok || !ownerRes.data?.brain_repo || !ownerRes.data.anthropic_api_key) {
      return NextResponse.json({ error: "This assistant isn't configured yet." }, { status: 503 });
    }
    const { brain_repo, github_token, anthropic_api_key } = ownerRes.data;

    // 7. Authoritative spec + zone-scoped knowledge (ContainmentGuard bounds every read).
    const specRow = await fetchCurrentSpec(persona);
    const specFields = specRow ? parsePersonaSpecMarkdown(specRow.body_md) : {};
    const { config: zoneConfig } = await loadZoneConfig(brain_repo, github_token);

    let knowledge;
    try {
      knowledge = await loadKnowledgeForChat(brain_repo, github_token, persona, zoneConfig);
    } catch (e) {
      if (e instanceof ContainmentBlockedError) {
        const convoId = await ensureConversation(conversationId, persona.id);
        await insertMessage({
          conversation_id: convoId,
          role: "system",
          content: `Containment block: ${e.message}`,
          tokens_used: 0,
          blocked_by_containment: true,
        });
        return NextResponse.json(
          { error: "This assistant hit a configuration issue. The owner has been notified." },
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

    // 8. Conversation + history.
    const convoId = await ensureConversation(conversationId, persona.id);
    const prior = await listMessages(convoId);
    const history = prior
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-MAX_HISTORY)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    await insertMessage({ conversation_id: convoId, role: "user", content: message, tokens_used: 0 });

    // 8b. Pre-chat form lead — captured once, on the first turn of a new conversation.
    // Bound to THIS persona + business; visitor-supplied fields are data only.
    const isFirstTurn = !conversationId;
    if (parsed.data.lead && isFirstTurn) {
      try {
        const lead = await insertLead({
          persona_id: persona.id,
          email: parsed.data.lead.email,
          phone: parsed.data.lead.phone || null,
          name: parsed.data.lead.name || null,
          conversation_id: convoId,
          source: "pre_chat_form",
        });
        const ownerEmail = await fetchOwnerEmail(persona.business_id);
        await routeLeadToInbox({
          persona,
          lead,
          transcript: [{ role: "user", content: message }],
          ownerEmail,
        });
      } catch {
        /* pre-chat lead capture is best-effort */
      }
    }

    // 9. Lead capture (in-conversation fallback to the pre-chat form). Best-effort: a
    // failure here never blocks the chat turn. Visitor-supplied content is stored as data,
    // always bound to THIS persona + business (no cross-tenant write — Adversarial §3(f)).
    if (widgetConfig?.lead_capture_enabled !== false) {
      const extracted = extractLeadFromText(message);
      if (hasLeadSignal(extracted)) {
        try {
          const lead = await insertLead({
            persona_id: persona.id,
            email: extracted.email,
            phone: extracted.phone,
            name: extracted.name,
            conversation_id: convoId,
            source: tokenRow.mode === "widget" ? "widget" : "public_link",
          });
          const ownerEmail = await fetchOwnerEmail(persona.business_id);
          const transcript = [...history, { role: "user", content: message }];
          await routeLeadToInbox({ persona, lead, transcript, ownerEmail });
        } catch {
          /* lead capture is best-effort */
        }
      }
    }

    // 10. Model stream. onTurnComplete fires the monthly cap-threshold notifications.
    const messages = [...history, { role: "user" as const, content: message }];
    const upstream = await openModelStream(anthropic_api_key, systemPrompt, messages);
    if (!upstream.ok) {
      return NextResponse.json({ error: upstream.error }, { status: 502 });
    }

    return streamPersonaResponse({
      upstream: upstream.body,
      conversationId: convoId,
      personaId: persona.id,
      onTurnComplete: async () => {
        await maybeNotifyCap(persona.business_id, persona.id);
      },
    });
  } catch (e) {
    const status = e instanceof PersonaDbError ? e.status : 500;
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unexpected error" },
      { status },
    );
  }
}

async function ensureConversation(conversationId: string | undefined, personaId: string): Promise<string> {
  if (conversationId) {
    const convo = await fetchConversation(conversationId);
    if (convo && convo.persona_id === personaId) return conversationId;
  }
  const created = await insertConversation({ persona_id: personaId, seat_id: null });
  return created.id;
}

// Checks the post-turn monthly count against 50/80/100% and fires the owner email exactly
// once per threshold per month (markCapNotified is the fire-once gate).
async function maybeNotifyCap(businessId: string, personaId: string): Promise<void> {
  const tier = await getCurrentTier(businessId);
  const capValue = TIER_LIMITS[tier].messagesPerMonthPerPersona;
  if (capValue === null || capValue === 0) return;
  const usage = await fetchUsageMonthly(personaId, monthKey());
  const count = usage?.message_count ?? 0;
  const pct = (count / capValue) * 100;
  const persona = await fetchPersona(personaId);
  if (!persona) return;
  const ownerEmail = await fetchOwnerEmail(businessId);

  for (const threshold of [100, 80, 50] as const) {
    if (pct >= threshold && (await markCapNotified(personaId, monthKey(), threshold))) {
      await notifyCapThreshold({ persona, ownerEmail, threshold, cap: capValue });
      break; // fire only the highest newly-crossed threshold this turn
    }
  }
}
