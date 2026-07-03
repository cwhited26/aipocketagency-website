// trial-runner.ts — turns 3+ of the cold thread (§22.1 steps 3-7): progressive discovery,
// capability qualification, and REAL work delivered in trial mode. Trial mode is the §22.2
// contract — the composed agent's Apps deliver drafts, summaries, and lists as previews
// ("Preview only — save my brain to send it for real."), never a live send: the sender hasn't
// OAuth'd anything, so there is nothing to send WITH, and the preview footer is the honest
// framing of that. One model call per turn against the platform key; the handler owns every
// deterministic gate (moderation first, rate limits, the value ask) — the model never decides
// when to ask for money.

import { completeLlmWithTarget } from "@/lib/llm/dispatch";
import { PA_MANAGED_MODEL } from "@/lib/llm/types";
import { appsByIds, sanitizeAppIds } from "@/lib/apps/catalog";
import { coldLog } from "./log";
import { hashPhoneForLog } from "./phone";
import { TRIAL_PREVIEW_FOOTER } from "./poc-voice";
import type { ConversationState } from "./types";

// WhatsApp reads best short; also keeps a staged reply inside the interactive 1024 cap.
const MAX_REPLY_CHARS = 950;

export type TrialTurnResult =
  | { ok: true; reply: string; actionDelivered: boolean; fact: string | null }
  | { ok: false };

function pocSystem(state: ConversationState): string {
  const composed = state.composed;
  const appLabels = composed
    ? appsByIds(sanitizeAppIds(composed.apps)).map((a) => a.label)
    : [];

  return [
    "You are Poc — Pocket Agent's operator character, working a WhatsApp trial thread with a",
    "small-business owner. Sharp, warm, competent, curious. First person singular.",
    "",
    "Voice rules (hard):",
    '- Confirmations are short: "On it." / "Got you." / "Done." Never "Happy to help!",',
    '  never "That\'s amazing!", never "Great question!", never "I\'d love to...".',
    "- No exclamation points. No emoji unless the owner uses them first. No time estimates.",
    '- Own misses plainly: "That miss is on me." — never grovel.',
    "- Don't over-explain. One question at a time. Read the owner's tone and match it.",
    "- Never break character. You are Poc, not a language model.",
    "",
    "Trial-mode rules (hard):",
    "- You can DRAFT anything (emails, replies, posts, follow-up lists, summaries) but you",
    "  cannot send, post, or connect to any account. Every deliverable is a preview.",
    `- End every deliverable with the exact line: "${TRIAL_PREVIEW_FOOTER}"`,
    "- NEVER ask the owner to sign up, pay, connect an account, or grant access. The product",
    "  handles that moment itself — your job is the work.",
    "- Early turns: one discovery question that qualifies the capability (platform, audience,",
    "  who the customers are). Once you know enough, DELIVER — a concrete draft beats another",
    "  question.",
    "",
    composed
      ? [
          `Your composed role: ${composed.personaName} (${composed.tone}).`,
          `The job: ${composed.intent.summary}`,
          appLabels.length > 0 ? `Apps in your toolkit: ${appLabels.join(", ")}.` : "",
        ]
          .filter(Boolean)
          .join("\n")
      : "No role is composed yet — find out what job the owner needs done.",
    state.facts.length > 0
      ? `\nWhat you know about this owner so far:\n${state.facts.map((f) => `- ${f}`).join("\n")}`
      : "",
    "",
    `Keep the reply under ${MAX_REPLY_CHARS} characters — this is WhatsApp.`,
    "",
    "Reply with ONE JSON object only, no fences:",
    '{"reply":"<what Poc says>","action_delivered":<true iff the reply contains a finished,',
    'usable deliverable (a full draft, list, or summary — not a question or a plan)>,',
    '"fact":"<one new business fact the owner just told you, or null>"}',
  ].join("\n");
}

function parseTurn(text: string): { reply: string; actionDelivered: boolean; fact: string | null } | null {
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
  const obj = raw as Record<string, unknown>;
  if (typeof obj.reply !== "string" || obj.reply.trim().length === 0) return null;
  return {
    reply: obj.reply.trim().slice(0, MAX_REPLY_CHARS),
    actionDelivered: obj.action_delivered === true,
    fact: typeof obj.fact === "string" && obj.fact.trim().length > 0 ? obj.fact.trim() : null,
  };
}

export type TrialRunnerDeps = {
  complete: typeof completeLlmWithTarget;
};

const defaultDeps: TrialRunnerDeps = { complete: completeLlmWithTarget };

/** Runs one trial turn. The caller appends the inbound to history AFTER a successful turn. */
export async function runTrialTurn(
  params: {
    senderPhone: string;
    state: ConversationState;
    inboundText: string;
    anthropicKey: string;
  },
  deps: TrialRunnerDeps = defaultDeps,
): Promise<TrialTurnResult> {
  const sender = hashPhoneForLog(params.senderPhone);

  const history = params.state.history.map((t) => ({
    role: t.role === "owner" ? ("user" as const) : ("assistant" as const),
    content: t.text,
  }));

  const res = await deps.complete(
    { provider: "anthropic", model: PA_MANAGED_MODEL, apiKey: params.anthropicKey },
    {
      system: pocSystem(params.state),
      messages: [...history, { role: "user", content: params.inboundText.slice(0, 2_000) }],
      maxTokens: 1_200,
    },
  );

  if (!res.ok) {
    coldLog.warn("trial turn call failed", { sender, status: res.status });
    return { ok: false };
  }

  coldLog.info("trial turn tokens", {
    sender,
    model: res.model,
    tokensInput: res.inputTokens,
    tokensOutput: res.outputTokens,
  });

  const turn = parseTurn(res.text);
  if (!turn) {
    coldLog.warn("trial turn output unparseable", { sender });
    return { ok: false };
  }
  return { ok: true, ...turn };
}

// Exported for the trial-runner unit tests.
export const trialRunnerInternals = { pocSystem, parseTurn, MAX_REPLY_CHARS };
