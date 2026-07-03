// The §22.1 conversation contract, end to end against mocked deps: turn-2 bundle shape (and
// its NO-ask rule), compose-on-turn-1, moderation decline, fail-closed outage, the value ask
// firing only at >= 3 delivered actions, and the turn-cap pause.

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { encrypt } from "@/lib/crypto/encrypt";

// The state envelope rides the shared AES helper, which reads its key from env.
const ORIGINAL_KEY = process.env.GMAIL_TOKEN_ENCRYPTION_KEY;
beforeAll(() => {
  process.env.GMAIL_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
});
afterAll(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.GMAIL_TOKEN_ENCRYPTION_KEY;
  else process.env.GMAIL_TOKEN_ENCRYPTION_KEY = ORIGINAL_KEY;
});
import { handleColdWhatsappInbound, readConversationState } from "../handler";
import type { ColdHandlerDeps } from "../handler";
import { evaluateRateLimit } from "../limits";
import {
  MAX_UNMIGRATED_TURNS,
  emptyConversationState,
  type ColdOutbound,
  type ConversationState,
  type TrialComposed,
  type TrialThreadRow,
} from "../types";
import { POC_GREETING, POC_MODERATION_DECLINE, USE_CASE_CARDS } from "../poc-voice";
import type { ParsedIntent } from "@/lib/agent-builder/types";

const NOW = new Date("2026-07-03T12:00:00.000Z");
const SENDER = "15551234567";

const INTENT: ParsedIntent = {
  summary: "Draft and chase sales follow-ups",
  jobNoun: "Sales Follow-Up",
  role: "sales",
  watches: "",
  does: "Drafts follow-up emails for stale leads",
  voice: "owner",
  schedule: null,
  brainZones: [],
  capabilities: ["follow_up"],
  neededTechniques: [],
};

const COMPOSED: TrialComposed = {
  specText: "Setup a Sales agent for me",
  intent: INTENT,
  personaTemplateKey: "sales",
  personaName: "Sales Assistant — Sales Follow-Up",
  personaSlug: "sales-assistant-sales-follow-up",
  tone: "direct",
  starterPrompt: "Run a first pass now: Draft and chase sales follow-ups",
  customFields: {},
  apps: ["follow-up-sweeps"],
  skillSlugs: [],
};

function makeThread(overrides: Partial<TrialThreadRow> = {}): TrialThreadRow {
  return {
    sender_phone: SENDER,
    thread_id: "11111111-1111-1111-1111-111111111111",
    composed_persona_slug: COMPOSED.personaSlug,
    composed_apps: COMPOSED.apps,
    composed_skill_slugs: [],
    conversation_state: encrypt(
      JSON.stringify({
        ...emptyConversationState(),
        stage: "working",
        composed: COMPOSED,
      } satisfies ConversationState),
    ),
    turn_count: 4,
    actions_delivered: 0,
    status: "active",
    starts_in_window: 1,
    window_started_at: NOW.toISOString(),
    cooloff_until: null,
    first_seen_at: NOW.toISOString(),
    last_active_at: NOW.toISOString(),
    converted_to_owner_id: null,
    ...overrides,
  };
}

type SentBundle = { to: string; bundle: readonly ColdOutbound[] };

function makeDeps(args: {
  thread: TrialThreadRow | null;
  overrides?: Partial<ColdHandlerDeps>;
}): { deps: ColdHandlerDeps; sent: SentBundle[]; patches: Array<Record<string, unknown>> } {
  const sent: SentBundle[] = [];
  const patches: Array<Record<string, unknown>> = [];
  const deps: ColdHandlerDeps = {
    config: () => ({
      phoneNumberId: "PUBLIC_PNID",
      accessToken: "token",
      appSecret: "secret",
      anthropicKey: "sk-test",
    }),
    fetchThread: vi.fn(async () => ({ ok: true as const, data: args.thread })),
    insertThread: vi.fn(async () => ({ ok: true as const, data: makeThread({ turn_count: 0 }) })),
    updateThread: vi.fn(async (_phone: string, patch: Record<string, unknown>) => {
      patches.push(patch);
      return { ok: true as const, data: args.thread ?? makeThread() };
    }),
    rateLimit: evaluateRateLimit,
    moderate: vi.fn(async () => ({ verdict: "ok" as const })),
    compose: vi.fn(async () => ({ ok: true as const, composed: COMPOSED })),
    runTurn: vi.fn(async () => ({
      ok: true as const,
      reply: "Here's the draft for the Miller lead.",
      actionDelivered: true,
      fact: "Runs a med spa in Alpharetta",
    })),
    send: vi.fn(async (_config, to, bundle) => {
      sent.push({ to, bundle });
      return bundle.length;
    }),
    checkoutUrl: (threadId: string) => `https://aipocketagent.com/api/whatsapp-trial/checkout?t=${threadId}`,
    now: () => NOW,
    ...args.overrides,
  };
  return { deps, sent, patches };
}

const INBOUND = { from: SENDER, text: "Setup a Sales agent for me", messageId: "wamid.1" };

describe("handleColdWhatsappInbound (§22.1)", () => {
  it("turn 1 composes, turn 2 sends contact card + greeting + 3 use-case cards, no ask", async () => {
    const { deps, sent } = makeDeps({ thread: null });
    const outcome = await handleColdWhatsappInbound(INBOUND, deps);
    expect(outcome).toEqual({ handled: "composed" });
    expect(deps.compose).toHaveBeenCalledOnce();

    expect(sent).toHaveLength(1);
    const bundle = sent[0].bundle;
    expect(bundle.map((m) => m.kind)).toEqual(["text", "contact_card", "buttons"]);
    const buttons = bundle[2];
    if (buttons.kind !== "buttons") throw new Error("expected buttons");
    expect(buttons.buttons).toEqual([...USE_CASE_CARDS]);

    // §22.1 turn 2: NO OAuth ask, NO signup ask, NO tier ask.
    const allText = bundle
      .map((m) => (m.kind === "contact_card" ? "" : m.text))
      .join(" ")
      .toLowerCase();
    for (const banned of ["oauth", "sign up", "signup", "connect your", "$", "/mo", "tier", "checkout"]) {
      expect(allText.includes(banned), `turn-2 bundle contains "${banned}"`).toBe(false);
    }
  });

  it("greets without composing when the first message isn't a spec", async () => {
    const { deps, sent } = makeDeps({
      thread: null,
      overrides: { compose: vi.fn(async () => ({ ok: false as const, reason: "parse_miss" as const })) },
    });
    const outcome = await handleColdWhatsappInbound({ ...INBOUND, text: "hi" }, deps);
    expect(outcome).toEqual({ handled: "greeted" });
    const buttons = sent[0].bundle[2];
    if (buttons.kind !== "buttons") throw new Error("expected buttons");
    expect(buttons.text).toBe(POC_GREETING);
  });

  it("declines a flagged inbound and burns a turn toward the cap", async () => {
    const thread = makeThread();
    const { deps, sent, patches } = makeDeps({
      thread,
      overrides: {
        moderate: vi.fn(async () => ({ verdict: "decline" as const, category: "abusive" as const })),
      },
    });
    const outcome = await handleColdWhatsappInbound(INBOUND, deps);
    expect(outcome).toEqual({ handled: "moderation_declined" });
    expect(sent[0].bundle).toEqual([{ kind: "text", text: POC_MODERATION_DECLINE }]);
    expect(patches[0]).toMatchObject({ turn_count: thread.turn_count + 1 });
    expect(deps.compose).not.toHaveBeenCalled();
    expect(deps.runTurn).not.toHaveBeenCalled();
  });

  it("fails closed when the classifier is unavailable — nothing composes", async () => {
    const { deps } = makeDeps({
      thread: null,
      overrides: { moderate: vi.fn(async () => ({ verdict: "unavailable" as const })) },
    });
    const outcome = await handleColdWhatsappInbound(INBOUND, deps);
    expect(outcome).toEqual({ handled: "moderation_unavailable" });
    expect(deps.compose).not.toHaveBeenCalled();
    expect(deps.insertThread).not.toHaveBeenCalled();
  });

  it("does NOT value-ask before three delivered actions", async () => {
    const { deps, sent } = makeDeps({ thread: makeThread({ actions_delivered: 1 }) });
    await handleColdWhatsappInbound({ ...INBOUND, text: "draft it" }, deps);
    expect(sent[0].bundle).toHaveLength(1); // just the reply
  });

  it("value-asks exactly when the third action lands (§22.1 step 7)", async () => {
    const { deps, sent, patches } = makeDeps({ thread: makeThread({ actions_delivered: 2 }) });
    await handleColdWhatsappInbound({ ...INBOUND, text: "draft it" }, deps);
    expect(sent[0].bundle).toHaveLength(2);
    const ask = sent[0].bundle[1];
    if (ask.kind !== "text") throw new Error("expected text");
    expect(ask.text).toContain("save my brain to your own GitHub");
    expect(ask.text).toContain("/api/whatsapp-trial/checkout");
    expect(patches[0]).toMatchObject({ actions_delivered: 3 });
  });

  it("never value-asks twice", async () => {
    const state: ConversationState = {
      ...emptyConversationState(),
      stage: "working",
      composed: COMPOSED,
      valueAskSent: true,
    };
    const { deps, sent } = makeDeps({
      thread: makeThread({
        actions_delivered: 5,
        conversation_state: encrypt(JSON.stringify(state)),
      }),
    });
    await handleColdWhatsappInbound({ ...INBOUND, text: "another one" }, deps);
    expect(sent[0].bundle).toHaveLength(1);
  });

  it("never value-asks a converted thread", async () => {
    const { deps, sent } = makeDeps({
      thread: makeThread({ status: "converted", actions_delivered: 9, converted_to_owner_id: "u1" }),
    });
    await handleColdWhatsappInbound({ ...INBOUND, text: "another one" }, deps);
    expect(sent[0].bundle).toHaveLength(1);
  });

  it("sends ONE pause notice at the turn cap, then hard silence", async () => {
    const capped = makeThread({ turn_count: MAX_UNMIGRATED_TURNS });
    const first = makeDeps({ thread: capped });
    const outcome = await handleColdWhatsappInbound(INBOUND, first.deps);
    expect(outcome).toEqual({ handled: "paused" });
    expect(first.sent).toHaveLength(1);
    expect(first.patches[0]).toMatchObject({ status: "paused" });

    const second = makeDeps({ thread: makeThread({ status: "paused" }) });
    const silent = await handleColdWhatsappInbound(INBOUND, second.deps);
    expect(silent).toEqual({ handled: "silenced" });
    expect(second.sent).toHaveLength(0);
  });

  it("accumulates facts and encrypts state at rest", async () => {
    const thread = makeThread();
    const { deps, patches } = makeDeps({ thread });
    await handleColdWhatsappInbound({ ...INBOUND, text: "I run a med spa" }, deps);
    const stored = patches[0].conversation_state;
    expect(typeof stored).toBe("string");
    expect(stored as string).toMatch(/^v1\./); // AES envelope, not plaintext JSON
    const state = readConversationState(
      { ...thread, conversation_state: stored as string },
      "test",
    );
    expect(state.facts).toContain("Runs a med spa in Alpharetta");
    expect(state.history.at(-1)).toEqual({
      role: "poc",
      text: "Here's the draft for the Miller lead.",
    });
  });

  it("is disabled without env config", async () => {
    const { deps } = makeDeps({ thread: null, overrides: { config: () => null } });
    const outcome = await handleColdWhatsappInbound(INBOUND, deps);
    expect(outcome).toEqual({ handled: "disabled" });
    expect(deps.fetchThread).not.toHaveBeenCalled();
  });
});
