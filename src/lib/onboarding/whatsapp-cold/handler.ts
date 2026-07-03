// handler.ts — the cold-onboarding conversation engine (PA-POS-32, Positioning Lock §22.1).
//
// One inbound from an unknown sender on PA's public WhatsApp number flows: rate limits (§22.4,
// before any model spend) → Haiku moderation gate (before the compose engine, fail closed) →
// the turn state machine:
//
//   turn 1  compose the Persona from the first message via the shipped Agent Builder engine
//   turn 2  save-contact card + Poc's greeting + 3 use-case cards — NO OAuth, NO signup,
//           NO tier ask
//   turns 3-6  progressive discovery + capability qualifier (trial-runner)
//   turn 7+    real work in trial mode — drafts as previews
//   value ask  ONLY after >= 3 real actions delivered, appended deterministically here —
//              the model never decides when to ask for money
//
// Conversation state is encrypted at rest (AES envelope over the Zod-validated JSON). Every
// log line correlates on the sender hash, never the phone.

import { decrypt, DecryptionError } from "@/lib/crypto/encrypt";
import { encrypt } from "@/lib/crypto/encrypt";
import { normalizeWhatsappNumber } from "@/lib/channels/adapters/whatsapp/adapter";
import { coldWhatsappConfig, type ColdWhatsappConfig } from "./config";
import {
  fetchTrialThread,
  insertTrialThread,
  updateTrialThread,
  type ColdDbResult,
  type TrialThreadPatch,
} from "./db";
import { evaluateRateLimit, type RateDecision } from "./limits";
import { moderateColdInbound, type ModerationVerdict } from "./moderation";
import { composeTrialAgent, type TrialComposeResult } from "./compose";
import { runTrialTurn, type TrialTurnResult } from "./trial-runner";
import { sendColdOutbound } from "./outbound";
import { buildTrialCheckoutUrl } from "./checkout";
import {
  POC_GREETING,
  POC_MODERATION_DECLINE,
  POC_PARSE_MISS,
  POC_RATE_LIMITED,
  POC_SAVE_CONTACT_LINE,
  POC_TRY_AGAIN,
  POC_TURN_CAP_PAUSE,
  POC_VALUE_ASK,
  USE_CASE_CARDS,
  VALUE_ASK_BUTTON_LABEL,
  pocComposedGreeting,
} from "./poc-voice";
import {
  ConversationStateSchema,
  VALUE_ASK_MIN_ACTIONS,
  emptyConversationState,
  type ColdOutbound,
  type ConversationState,
  type TrialThreadRow,
} from "./types";
import { coldLog } from "./log";
import { hashPhoneForLog } from "./phone";

export type ColdInboundOutcome = {
  handled:
    | "disabled"
    | "rate_limited"
    | "paused"
    | "silenced"
    | "moderation_declined"
    | "moderation_unavailable"
    | "greeted"
    | "composed"
    | "turn"
    | "error";
};

export type ColdHandlerDeps = {
  config: () => ColdWhatsappConfig | null;
  fetchThread: typeof fetchTrialThread;
  insertThread: typeof insertTrialThread;
  updateThread: typeof updateTrialThread;
  rateLimit: (thread: TrialThreadRow | null, now: Date) => RateDecision;
  moderate: (params: {
    senderPhone: string;
    text: string;
    anthropicKey: string;
  }) => Promise<ModerationVerdict>;
  compose: (params: {
    senderPhone: string;
    specText: string;
    anthropicKey: string;
  }) => Promise<TrialComposeResult>;
  runTurn: (params: {
    senderPhone: string;
    state: ConversationState;
    inboundText: string;
    anthropicKey: string;
  }) => Promise<TrialTurnResult>;
  send: typeof sendColdOutbound;
  checkoutUrl: (threadId: string) => string;
  now: () => Date;
};

const defaultDeps: ColdHandlerDeps = {
  config: coldWhatsappConfig,
  fetchThread: fetchTrialThread,
  insertThread: insertTrialThread,
  updateThread: updateTrialThread,
  rateLimit: evaluateRateLimit,
  moderate: moderateColdInbound,
  compose: composeTrialAgent,
  runTurn: runTrialTurn,
  send: sendColdOutbound,
  checkoutUrl: buildTrialCheckoutUrl,
  now: () => new Date(),
};

/** Decrypt + validate the stored state; any miss falls back to a fresh state (logged). */
export function readConversationState(row: TrialThreadRow, sender: string): ConversationState {
  if (!row.conversation_state) return emptyConversationState();
  let json: unknown;
  try {
    json = JSON.parse(decrypt(row.conversation_state)) as unknown;
  } catch (err) {
    if (err instanceof DecryptionError || err instanceof SyntaxError) {
      coldLog.warn("conversation state unreadable — resetting", { sender });
      return emptyConversationState();
    }
    throw err;
  }
  const parsed = ConversationStateSchema.safeParse(json);
  if (!parsed.success) {
    coldLog.warn("conversation state failed validation — resetting", { sender });
    return emptyConversationState();
  }
  return parsed.data;
}

function pushHistory(state: ConversationState, ownerText: string, pocText: string): void {
  state.history.push({ role: "owner", text: ownerText.slice(0, 4_096) });
  state.history.push({ role: "poc", text: pocText.slice(0, 4_096) });
  while (state.history.length > 16) state.history.shift();
}

function statePatch(state: ConversationState): Pick<TrialThreadPatch, "conversation_state"> {
  return { conversation_state: encrypt(JSON.stringify(state)) };
}

function greetingBundle(state: ConversationState): ColdOutbound[] {
  const greeting = state.composed
    ? pocComposedGreeting(state.composed.personaName)
    : POC_GREETING;
  return [
    { kind: "text", text: POC_SAVE_CONTACT_LINE },
    { kind: "contact_card" },
    { kind: "buttons", text: greeting, buttons: [...USE_CASE_CARDS] },
  ];
}

function valueAskBundle(checkoutUrl: string): ColdOutbound[] {
  // Cloud API reply buttons carry no URLs (Phase 4 finding) — the link flattens to a line.
  return [
    { kind: "text", text: `${POC_VALUE_ASK}\n\n${VALUE_ASK_BUTTON_LABEL}: ${checkoutUrl}` },
  ];
}

async function bestEffortUpdate(
  update: Promise<ColdDbResult<TrialThreadRow>>,
  sender: string,
  what: string,
): Promise<void> {
  const res = await update;
  if (!res.ok) {
    coldLog.error(`thread update failed (${what})`, { sender, status: res.status });
  }
}

/**
 * Handles one signature-verified inbound from an unknown sender on the PA public number.
 * The route swallows throws into the webhook ack; everything here degrades to a logged
 * outcome instead of throwing where it can.
 */
export async function handleColdWhatsappInbound(
  params: { from: string; text: string; messageId: string },
  deps: ColdHandlerDeps = defaultDeps,
): Promise<ColdInboundOutcome> {
  const config = deps.config();
  if (!config) return { handled: "disabled" };

  const senderPhone = normalizeWhatsappNumber(params.from);
  const sender = hashPhoneForLog(senderPhone);
  const now = deps.now();
  const nowIso = now.toISOString();

  const threadRes = await deps.fetchThread(senderPhone);
  if (!threadRes.ok) {
    coldLog.error("thread fetch failed", { sender, status: threadRes.status });
    return { handled: "error" };
  }
  let thread = threadRes.data;

  // ── §22.4 rate limits — before any model spend ────────────────────────────────────────────
  const decision = deps.rateLimit(thread, now);
  if (!decision.allowed) {
    if (decision.reason === "silent") return { handled: "silenced" };
    if (decision.reason === "turn_cap") {
      // One pause notice (with the conversion path), then hard silence.
      if (decision.notify && thread) {
        await deps.send(config, senderPhone, [
          {
            kind: "text",
            text: `${POC_TURN_CAP_PAUSE}\n\n${VALUE_ASK_BUTTON_LABEL}: ${deps.checkoutUrl(thread.thread_id)}`,
          },
        ]);
        await bestEffortUpdate(
          deps.updateThread(senderPhone, { status: "paused", last_active_at: nowIso }),
          sender,
          "turn cap pause",
        );
      }
      coldLog.info("cold thread paused at turn cap", { sender });
      return { handled: "paused" };
    }
    // cooloff / window_exhausted
    if (decision.notify) {
      await deps.send(config, senderPhone, [{ kind: "text", text: POC_RATE_LIMITED }]);
      if (thread) {
        await bestEffortUpdate(
          deps.updateThread(senderPhone, { status: "declined", last_active_at: nowIso }),
          sender,
          "rate limit decline",
        );
      }
    }
    coldLog.info("cold inbound rate limited", { sender, reason: decision.reason });
    return { handled: "rate_limited" };
  }

  // ── §22.4 classifier gate — before the compose engine, fail closed ────────────────────────
  const verdict = await deps.moderate({
    senderPhone,
    text: params.text,
    anthropicKey: config.anthropicKey,
  });
  if (verdict.verdict === "unavailable") {
    await deps.send(config, senderPhone, [{ kind: "text", text: POC_TRY_AGAIN }]);
    return { handled: "moderation_unavailable" };
  }
  if (verdict.verdict === "decline") {
    await deps.send(config, senderPhone, [{ kind: "text", text: POC_MODERATION_DECLINE }]);
    if (thread) {
      // A flagged turn still burns budget toward the 20-turn cap.
      await bestEffortUpdate(
        deps.updateThread(senderPhone, {
          turn_count: thread.turn_count + 1,
          last_active_at: nowIso,
        }),
        sender,
        "moderation decline",
      );
    }
    return { handled: "moderation_declined" };
  }

  // ── Thread start / restart: turn 1 composes, turn 2 greets ───────────────────────────────
  if (decision.restart) {
    if (!thread) {
      const created = await deps.insertThread({ senderPhone });
      if (!created.ok) {
        coldLog.error("thread insert failed", { sender, status: created.status });
        return { handled: "error" };
      }
      thread = created.data;
    }

    const state = emptyConversationState();
    const composeRes = await deps.compose({
      senderPhone,
      specText: params.text,
      anthropicKey: config.anthropicKey,
    });
    if (composeRes.ok) {
      state.stage = "working";
      state.composed = composeRes.composed;
    } else if (composeRes.reason === "unavailable") {
      await deps.send(config, senderPhone, [{ kind: "text", text: POC_TRY_AGAIN }]);
      return { handled: "error" };
    }
    // parse_miss is fine — the first message was a greeting, not a spec. Poc asks.

    const bundle = greetingBundle(state);
    pushHistory(
      state,
      params.text,
      state.composed ? pocComposedGreeting(state.composed.personaName) : POC_GREETING,
    );
    await deps.send(config, senderPhone, bundle);
    await bestEffortUpdate(
      deps.updateThread(senderPhone, {
        status: "active",
        turn_count: 1,
        actions_delivered: 0,
        starts_in_window: decision.startsInWindow,
        window_started_at: decision.windowStartedAt,
        composed_persona_slug: state.composed?.personaSlug ?? null,
        composed_apps: state.composed?.apps ?? [],
        composed_skill_slugs: state.composed?.skillSlugs ?? [],
        last_active_at: nowIso,
        ...statePatch(state),
      }),
      sender,
      "thread start",
    );
    coldLog.info("cold thread started", { sender, composed: state.composed !== null });
    return { handled: state.composed ? "composed" : "greeted" };
  }

  // ── Turns 3+ on a live thread ─────────────────────────────────────────────────────────────
  if (!thread) return { handled: "error" }; // restart=false implies a row exists.
  const state = readConversationState(thread, sender);
  const patch: TrialThreadPatch = {
    turn_count: thread.turn_count + 1,
    last_active_at: nowIso,
  };

  // A greeted-but-uncomposed thread composes from the first substantive reply (§22.1 turn 3).
  if (!state.composed) {
    const composeRes = await deps.compose({
      senderPhone,
      specText: params.text,
      anthropicKey: config.anthropicKey,
    });
    if (composeRes.ok) {
      state.stage = "working";
      state.composed = composeRes.composed;
      patch.composed_persona_slug = composeRes.composed.personaSlug;
      patch.composed_apps = composeRes.composed.apps;
      patch.composed_skill_slugs = composeRes.composed.skillSlugs;
    } else if (composeRes.reason === "unavailable") {
      await deps.send(config, senderPhone, [{ kind: "text", text: POC_TRY_AGAIN }]);
      return { handled: "error" };
    } else {
      // Still nothing composable ("ok", "cool") — Poc re-anchors on the job question.
      pushHistory(state, params.text, POC_PARSE_MISS);
      await deps.send(config, senderPhone, [{ kind: "text", text: POC_PARSE_MISS }]);
      await bestEffortUpdate(
        deps.updateThread(senderPhone, { ...patch, ...statePatch(state) }),
        sender,
        "parse miss turn",
      );
      return { handled: "turn" };
    }
  }

  const turn = await deps.runTurn({
    senderPhone,
    state,
    inboundText: params.text,
    anthropicKey: config.anthropicKey,
  });
  if (!turn.ok) {
    await deps.send(config, senderPhone, [{ kind: "text", text: POC_TRY_AGAIN }]);
    await bestEffortUpdate(
      deps.updateThread(senderPhone, patch),
      sender,
      "failed turn",
    );
    return { handled: "error" };
  }

  pushHistory(state, params.text, turn.reply);
  if (turn.fact && !state.facts.includes(turn.fact)) {
    state.facts.push(turn.fact.slice(0, 300));
    while (state.facts.length > 40) state.facts.shift();
  }
  const actionsDelivered = thread.actions_delivered + (turn.actionDelivered ? 1 : 0);
  patch.actions_delivered = actionsDelivered;

  const bundle: ColdOutbound[] = [{ kind: "text", text: turn.reply }];

  // ── The value ask — deterministic, only after >= 3 real actions, never for a converted
  //    thread, never twice (§22.1 step 7) ─────────────────────────────────────────────────────
  if (
    thread.status !== "converted" &&
    !state.valueAskSent &&
    actionsDelivered >= VALUE_ASK_MIN_ACTIONS
  ) {
    bundle.push(...valueAskBundle(deps.checkoutUrl(thread.thread_id)));
    state.valueAskSent = true;
  }

  await deps.send(config, senderPhone, bundle);
  await bestEffortUpdate(
    deps.updateThread(senderPhone, { ...patch, ...statePatch(state) }),
    sender,
    "turn",
  );
  return { handled: "turn" };
}
