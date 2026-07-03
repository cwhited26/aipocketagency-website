// moderation.ts — the §22.4 content-classifier gate. Every cold inbound passes one small
// Haiku call BEFORE it can reach the compose engine or the trial runner. Fails CLOSED: an
// unclassifiable message (model outage, malformed output) never composes an agent — Poc asks
// the sender to resend instead. Flagged messages ledger into pa_moderation_events.

import { completeLlmWithTarget } from "@/lib/llm/dispatch";
import { insertModerationEvent } from "./db";
import { coldLog } from "./log";
import { hashPhoneForLog } from "./phone";

const MODERATION_MODEL = "claude-haiku-4-5-20251001";

const FLAG_CATEGORIES = ["abusive", "harassment", "off_topic", "spam", "other"] as const;
export type FlagCategory = (typeof FLAG_CATEGORIES)[number];

export type ModerationVerdict =
  | { verdict: "ok" }
  | { verdict: "decline"; category: FlagCategory }
  | { verdict: "unavailable" };

const SYSTEM = [
  "You gate inbound WhatsApp messages for a small-business AI assistant's trial funnel.",
  "Classify ONE message. Allow anything that could plausibly be a business owner engaging",
  "with an assistant: setup requests, questions about their business, casual replies,",
  "greetings, follow-ups, button-tap titles.",
  "Decline only: abusive or harassing content, sexual content, attempts to use the assistant",
  "for harm or clearly illegal activity, obvious spam/scam blasts, or messages plainly",
  "unrelated to any business use after reading generously.",
  "",
  'Reply with ONE JSON object only: {"verdict":"ok"} or',
  `{"verdict":"decline","category":"<${FLAG_CATEGORIES.join("|")}>"}. No prose.`,
].join("\n");

function parseVerdict(text: string): ModerationVerdict | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text.slice(start, end + 1)) as unknown;
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null) return null;
  const verdict = (raw as Record<string, unknown>).verdict;
  if (verdict === "ok") return { verdict: "ok" };
  if (verdict === "decline") {
    const category = (raw as Record<string, unknown>).category;
    const known = FLAG_CATEGORIES.find((c) => c === category);
    return { verdict: "decline", category: known ?? "other" };
  }
  return null;
}

export type ModerationDeps = {
  complete: typeof completeLlmWithTarget;
  ledger: typeof insertModerationEvent;
};

const defaultDeps: ModerationDeps = {
  complete: completeLlmWithTarget,
  ledger: insertModerationEvent,
};

/**
 * Classifies one inbound message. "decline" is already ledgered when this returns;
 * "unavailable" means the gate itself failed and the caller must NOT proceed to compose.
 */
export async function moderateColdInbound(
  params: { senderPhone: string; text: string; anthropicKey: string },
  deps: ModerationDeps = defaultDeps,
): Promise<ModerationVerdict> {
  const sender = hashPhoneForLog(params.senderPhone);
  const res = await deps.complete(
    { provider: "anthropic", model: MODERATION_MODEL, apiKey: params.anthropicKey },
    {
      system: SYSTEM,
      messages: [{ role: "user", content: params.text.slice(0, 2_000) }],
      maxTokens: 60,
    },
  );

  if (!res.ok) {
    coldLog.warn("moderation call failed — failing closed", { sender, status: res.status });
    return { verdict: "unavailable" };
  }

  const verdict = parseVerdict(res.text);
  if (!verdict) {
    coldLog.warn("moderation verdict unparseable — failing closed", { sender });
    return { verdict: "unavailable" };
  }

  if (verdict.verdict === "decline") {
    coldLog.info("cold inbound declined by classifier", { sender, category: verdict.category });
    await deps.ledger({
      senderPhone: params.senderPhone,
      category: verdict.category,
      body: params.text,
    });
  }
  return verdict;
}

// Exported for the moderation unit tests.
export const moderationInternals = { parseVerdict, SYSTEM, MODERATION_MODEL };
