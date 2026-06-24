// parse.ts — turn a reminder-shaped SMS ("remind me to call the dentist in 39 min") into a task +
// an absolute delivery time. Two stages so we only spend money on plausible reminders:
//
//   1. matchesReminderPattern() — a cheap regex pre-filter. A text that doesn't open with a reminder
//      phrase is never sent to the model; the webhook captures it as a normal note.
//   2. extractWithHaiku() — a single cheap Haiku call that decides if it's really a reminder, pulls
//      the task, and computes the absolute remind_at against the current time. Direct REST (no SDK —
//      repo rule), Zod-validated at the parse boundary, never throws (a failure degrades, not crashes).
//
// The model's time is then validated in pure code: confidence floor, the 90-day horizon cap
// (PC-Q11), and a "not in the past" guard. validateRemindAt + matchesReminderPattern are pure so the
// phrasing + cap behaviour is unit-tested without touching the network.

import { z } from "zod";
import { logCostFromUsage, type CostContext } from "@/lib/cost/log";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
// Cheap — this is a one-shot extraction, not generation. Pinned per the PC-CORE-5 cost contract.
const PARSE_MODEL = "claude-haiku-4-5-20251001";

// PC-Q11: reminders are capped at 90 days. Anything further out is calendar territory, not capture.
export const MAX_HORIZON_DAYS = 90;
const MAX_HORIZON_MS = MAX_HORIZON_DAYS * 24 * 60 * 60 * 1000;
// Below this the model wasn't sure enough about the time to schedule silently — ask the user instead.
const CONFIDENCE_FLOOR = 0.5;
// Allow a minute of clock skew / processing lag before calling a resolved time "in the past".
const PAST_GRACE_MS = 60_000;

// The opening phrases that mark a reminder. Permissive on purpose — the model is the final arbiter;
// this only gates the spend. Anchored to the start so "I'll remind him later" isn't a false positive.
const REMINDER_PREFILTER =
  /^\s*(?:please\s+)?(?:remind\s+me\b|set\s+(?:a\s+|an\s+)?reminder\b|remember\s+to\b|don'?t\s+let\s+me\s+forget\b|ping\s+me\b|nudge\s+me\b|wake\s+me\b)/i;

/** True when a text opens with a reminder phrase — the gate before any model spend. Pure. */
export function matchesReminderPattern(body: string): boolean {
  return REMINDER_PREFILTER.test(body);
}

export type ReminderParseFailure =
  | "no-time" // reminder intent, but no usable time could be extracted
  | "low-confidence" // the model wasn't confident enough about the time
  | "past-time" // the resolved time is already in the past
  | "horizon-exceeded" // beyond the 90-day cap (PC-Q11)
  | "llm-unavailable" // the owner has no Anthropic API key
  | "llm-error"; // network / API failure / unparseable model output

export type ReminderParseResult =
  | { isReminder: false }
  | { isReminder: true; ok: true; taskText: string; remindAt: Date; confidence: number }
  | { isReminder: true; ok: false; reason: ReminderParseFailure; error: string };

/**
 * User-fixable failures ("couldn't tell when", "too far out") warrant an SMS nudge so the owner can
 * rephrase; infra failures (no key, API down) degrade silently to a normal capture. Pure.
 */
export function isUserFixable(reason: ReminderParseFailure): boolean {
  return (
    reason === "no-time" ||
    reason === "low-confidence" ||
    reason === "past-time" ||
    reason === "horizon-exceeded"
  );
}

/** The raw shape the model returns. `null` from an extractor means an infra failure (→ llm-error). */
export type ReminderExtraction = {
  isReminder: boolean;
  task: string | null;
  /** Absolute ISO-8601 the model computed from the current time, or null when it couldn't. */
  remindAtIso: string | null;
  confidence: number;
};

export type ReminderExtractor = (input: {
  text: string;
  now: Date;
  timezone: string;
  apiKey: string;
  cost?: CostContext;
}) => Promise<ReminderExtraction | null>;

const EXTRACTION_SCHEMA = z.object({
  is_reminder: z.boolean(),
  task: z.string().nullable(),
  remind_at: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

type AnthropicResponse = {
  content?: Array<{ type: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
};

function buildPrompt(text: string, now: Date, timezone: string): string {
  return `You extract a reminder from a short text message. The current time is ${now.toISOString()} (timezone: ${timezone}).

The user wrote:
"""
${text}
"""

Decide whether the user is asking to be reminded to do something at a specific future time.

Return ONLY a JSON object (no prose, no code fence) with these keys:
- "is_reminder": boolean — true only if the user wants to be reminded to do something at a time.
- "task": string or null — the thing to be reminded of, short and imperative in the user's words (e.g. "call the dentist"). null if not a reminder.
- "remind_at": string or null — the absolute time as ISO-8601 with timezone offset, computed from the current time. null if you cannot determine a specific time.
- "confidence": number between 0 and 1 — your confidence in the extracted time.

Resolve relative times ("in 39 min", "tomorrow at 9am", "Thursday 3pm", "next Monday") against the current time. For a date with no clock time, default to 09:00 in the given timezone. Output JSON only.`;
}

// Pull the first {...} object out of the model's text and validate its shape. Tolerant of stray
// prose or a code fence around the JSON; returns null on anything unparseable.
function parseModelJson(raw: string): ReminderExtraction | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  let candidate: unknown;
  try {
    candidate = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  const parsed = EXTRACTION_SCHEMA.safeParse(candidate);
  if (!parsed.success) return null;
  return {
    isReminder: parsed.data.is_reminder,
    task: parsed.data.task,
    remindAtIso: parsed.data.remind_at,
    confidence: parsed.data.confidence,
  };
}

/**
 * The real extractor: one cheap Haiku call. Logs a single cost event when usage is returned. Never
 * throws — a network blip / non-2xx / unparseable body all degrade to null (the parser maps that to
 * llm-error and the webhook captures the text as a note instead).
 */
export const extractWithHaiku: ReminderExtractor = async ({ text, now, timezone, apiKey, cost }) => {
  let res: Response;
  try {
    res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: PARSE_MODEL,
        max_tokens: 256,
        messages: [{ role: "user", content: buildPrompt(text, now, timezone) }],
      }),
      cache: "no-store",
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const data = (await res.json()) as AnthropicResponse;
  if (cost) {
    await logCostFromUsage(cost, "anthropic", PARSE_MODEL, {
      tokensInput: data.usage?.input_tokens ?? 0,
      tokensOutput: data.usage?.output_tokens ?? 0,
    });
  }
  const reply = data.content?.find((c) => c.type === "text")?.text ?? "";
  return parseModelJson(reply);
};

/**
 * Validate a model-resolved reminder time against the business rules. Pure → unit-tested. A small
 * grace window absorbs clock skew so a "now"-ish reminder isn't rejected as past.
 */
export function validateRemindAt(
  remindAt: Date,
  now: Date,
): { ok: true } | { ok: false; reason: "past-time" | "horizon-exceeded"; error: string } {
  const delta = remindAt.getTime() - now.getTime();
  if (delta < -PAST_GRACE_MS) {
    return { ok: false, reason: "past-time", error: "the reminder time is already in the past" };
  }
  if (delta > MAX_HORIZON_MS) {
    return {
      ok: false,
      reason: "horizon-exceeded",
      error: `reminders are capped at ${MAX_HORIZON_DAYS} days out`,
    };
  }
  return { ok: true };
}

/**
 * Parse a reminder request end-to-end: regex gate → model extraction → pure validation. Returns a
 * discriminated result the webhook switches on. `extract` is injectable so tests exercise the full
 * pipeline (phrasing, confidence, cap) without the network.
 */
export async function parseReminderRequest(params: {
  text: string;
  now: Date;
  timezone?: string;
  apiKey: string | null;
  cost?: CostContext;
  extract?: ReminderExtractor;
}): Promise<ReminderParseResult> {
  if (!matchesReminderPattern(params.text)) return { isReminder: false };
  if (!params.apiKey) {
    return { isReminder: true, ok: false, reason: "llm-unavailable", error: "owner has no Anthropic API key" };
  }

  const extract = params.extract ?? extractWithHaiku;
  const extraction = await extract({
    text: params.text,
    now: params.now,
    timezone: params.timezone ?? "UTC",
    apiKey: params.apiKey,
    cost: params.cost,
  });
  if (!extraction) {
    return { isReminder: true, ok: false, reason: "llm-error", error: "reminder extraction failed" };
  }

  const task = extraction.task?.trim();
  // The model decided it isn't a reminder (e.g. "remind me why this matters") — treat as a capture.
  if (!extraction.isReminder || !task) return { isReminder: false };

  if (extraction.confidence < CONFIDENCE_FLOOR) {
    return {
      ok: false,
      isReminder: true,
      reason: "low-confidence",
      error: `model confidence ${extraction.confidence} below ${CONFIDENCE_FLOOR}`,
    };
  }
  if (!extraction.remindAtIso) {
    return { isReminder: true, ok: false, reason: "no-time", error: "no time could be extracted" };
  }

  const remindAt = new Date(extraction.remindAtIso);
  if (Number.isNaN(remindAt.getTime())) {
    return { isReminder: true, ok: false, reason: "no-time", error: `unparseable time: ${extraction.remindAtIso}` };
  }

  const validation = validateRemindAt(remindAt, params.now);
  if (!validation.ok) {
    return { isReminder: true, ok: false, reason: validation.reason, error: validation.error };
  }

  return { isReminder: true, ok: true, taskText: task, remindAt, confidence: extraction.confidence };
}
