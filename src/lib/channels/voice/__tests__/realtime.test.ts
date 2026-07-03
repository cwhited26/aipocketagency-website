// realtime.test.ts — Voice v2 (PA-CHAN-15/16): the realtime bridge session, the two hard caps,
// the structural approval gate, the caller gate, the webhook classification, and the Poc prompt
// voice-check. Everything here runs against the fake sockets — no ws, no network.

import { describe, expect, it } from "vitest";
import type { VoiceSocket } from "../stream-loop";
import {
  RealtimeBridgeSession,
  type RealtimeSessionDeps,
  type RealtimeSocket,
} from "../realtime/session";
import {
  estimateRealtimeCallMicroCents,
  mulawBase64Seconds,
  RealtimeCostMeter,
  REALTIME_COST_CAP_MICRO_CENTS,
  REALTIME_WALL_CAP_SECONDS,
} from "../realtime/cost";
import {
  buildPocRealtimeInstructions,
  POC_BANNED_PHRASES,
  POC_CAP_FAREWELL,
  POC_DECLINE_UNKNOWN_CALLER,
  POC_INBOUND_GREETING,
} from "../realtime/prompt";
import { parseFunctionArgs, parseRealtimeEvent } from "../realtime/messages";
import { classifyVoiceWebhook, decodeVoiceWebhookBody, VoiceWebhookSchema } from "../../adapters/voice/adapter";
import { isCallerAllowed, type VoiceConnectionConfig } from "../connection";
import { computeTwilioSignature, verifyTwilioSignature } from "../twilio";

// ── Fakes ────────────────────────────────────────────────────────────────────────────────────

class FakeTwilioSocket implements VoiceSocket {
  mediaHandler: ((frame: Buffer, frameMs: number) => void | Promise<void>) | null = null;
  stopHandler: (() => void | Promise<void>) | null = null;
  sent: string[][] = [];
  closedReason: string | null = null;

  onMedia(handler: (frame: Buffer, frameMs: number) => void | Promise<void>): void {
    this.mediaHandler = handler;
  }
  onStop(handler: () => void | Promise<void>): void {
    this.stopHandler = handler;
  }
  sendFrames(frames: string[]): void {
    this.sent.push(frames);
  }
  close(reason: string): void {
    this.closedReason = reason;
  }
  async emitMedia(seconds: number): Promise<void> {
    await this.mediaHandler?.(Buffer.alloc(160), seconds * 1000);
  }
}

class FakeRealtimeSocket implements RealtimeSocket {
  events: Record<string, unknown>[] = [];
  handler: ((raw: string) => void | Promise<void>) | null = null;
  closedReason: string | null = null;

  sendEvent(event: Record<string, unknown>): void {
    this.events.push(event);
  }
  onEvent(handler: (raw: string) => void | Promise<void>): void {
    this.handler = handler;
  }
  close(reason: string): void {
    this.closedReason = reason;
  }
  async emit(event: Record<string, unknown>): Promise<void> {
    await this.handler?.(JSON.stringify(event));
  }
  ofType(type: string): Record<string, unknown>[] {
    return this.events.filter((e) => e.type === type);
  }
}

function makeDeps(overrides: Partial<RealtimeSessionDeps> = {}): {
  deps: RealtimeSessionDeps;
  staged: { name: string; args: Record<string, unknown> }[];
  recorded: { type: string; payload: Record<string, unknown> }[];
  hangups: string[];
} {
  const staged: { name: string; args: Record<string, unknown> }[] = [];
  const recorded: { type: string; payload: Record<string, unknown> }[] = [];
  const hangups: string[] = [];
  const deps: RealtimeSessionDeps = {
    instructions: "test instructions",
    openingResponse: true,
    async stageFunctionCall(name, args) {
      staged.push({ name, args });
      return "staged-item-1";
    },
    recordEvent(type, payload) {
      recorded.push({ type, payload });
    },
    async hangupCall(reason) {
      hangups.push(reason);
    },
    ...overrides,
  };
  return { deps, staged, recorded, hangups };
}

function makeSession(overrides: Partial<RealtimeSessionDeps> = {}) {
  const twilio = new FakeTwilioSocket();
  const openai = new FakeRealtimeSocket();
  const bag = makeDeps(overrides);
  const session = new RealtimeBridgeSession(twilio, openai, bag.deps);
  session.start();
  return { session, twilio, openai, ...bag };
}

// ── Session wiring ───────────────────────────────────────────────────────────────────────────

describe("realtime bridge session", () => {
  it("configures the session with instructions + µ-law audio + tools on start", () => {
    const { openai } = makeSession();
    const update = openai.ofType("session.update")[0] as {
      session: { instructions: string; tools: { name: string }[] };
    } & Record<string, unknown>;
    expect(update).toBeDefined();
    expect(update.session.instructions).toBe("test instructions");
    expect(update.session.tools.map((t) => t.name)).toEqual([
      "send_email",
      "schedule_meeting",
      "create_follow_up",
    ]);
    expect(openai.ofType("response.create").length).toBe(1);
  });

  it("relays caller audio to OpenAI and Poc audio back to Twilio", async () => {
    const { twilio, openai } = makeSession();
    await twilio.emitMedia(0.02);
    expect(openai.ofType("input_audio_buffer.append").length).toBe(1);

    const b64 = Buffer.alloc(800).toString("base64"); // 0.1s of µ-law
    await openai.emit({ type: "response.output_audio.delta", delta: b64 });
    expect(twilio.sent.flat()).toContain(b64);
  });

  it("ledgers caller + Poc transcript turns as speech events", async () => {
    const { openai, recorded, session } = makeSession();
    await openai.emit({
      type: "conversation.item.input_audio_transcription.completed",
      transcript: "What's the delivery window?",
    });
    await openai.emit({ type: "response.output_audio_transcript.done", transcript: "Got you. Let me pull that up." });
    const speech = recorded.filter((r) => r.type === "speech");
    expect(speech.map((s) => s.payload.role)).toEqual(["caller", "poc"]);
    expect(session.transcript.length).toBe(2);
  });
});

// ── The approval gate (PA-CHAN-16: staged, never executed) ─────────────────────────────────────

describe("realtime approval gate", () => {
  const fnCall = {
    type: "response.function_call_arguments.done",
    call_id: "call_1",
    name: "send_email",
    arguments: JSON.stringify({ to: "sam@acme.com", subject: "Thursday", body: "Confirming 9am." }),
  };

  it("stages a function call as an inbox card and pauses — the model is told 'staged', nothing executes", async () => {
    const { openai, staged, recorded } = makeSession();
    await openai.emit(fnCall);

    expect(staged).toEqual([
      { name: "send_email", args: { to: "sam@acme.com", subject: "Thursday", body: "Confirming 9am." } },
    ]);
    // The model's tool result says staged-for-approval — Poc's next line has to match reality.
    const outputs = openai.ofType("conversation.item.create") as {
      item: { output: string };
    }[] & Record<string, unknown>[];
    expect(outputs.length).toBe(1);
    expect(outputs[0].item.output).toContain("staged_for_approval");
    expect(outputs[0].item.output).not.toContain('"sent"');
    // The approval request is ledgered with the staged card id.
    const approvals = recorded.filter((r) => r.type === "approval_request");
    expect(approvals.length).toBe(1);
    expect(approvals[0].payload.stagedActionId).toBe("staged-item-1");
  });

  it("declines a malformed function call without staging", async () => {
    const { openai, staged, session } = makeSession();
    await openai.emit({ ...fnCall, arguments: '{"to": ""}' });
    expect(staged.length).toBe(0);
    expect(session.stagedCalls[0]?.outcome).toBe("declined_malformed");
    const outputs = openai.ofType("conversation.item.create") as { item: { output: string } }[] &
      Record<string, unknown>[];
    expect(outputs[0].item.output).toContain("declined");
  });

  it("declines an unknown tool name", async () => {
    const { openai, staged } = makeSession();
    await openai.emit({ ...fnCall, name: "delete_everything" });
    expect(staged.length).toBe(0);
  });

  it("tells the truth when staging fails", async () => {
    const { openai, session } = makeSession({
      stageFunctionCall: async () => null,
    });
    await openai.emit(fnCall);
    expect(session.stagedCalls[0]?.stagedActionId).toBeNull();
  });
});

// ── The two hard caps ───────────────────────────────────────────────────────────────────────────

describe("realtime hard caps", () => {
  it("hangs up with the farewell at the 30-minute wall cap", async () => {
    const { twilio, openai, hangups, session } = makeSession();
    // 31 minutes of caller audio in 62 half-minute frames.
    for (let i = 0; i < 62; i += 1) await twilio.emitMedia(30);

    expect(hangups).toEqual(["wall_cap"]);
    expect(session.capReason).toBe("wall_cap");
    const farewells = openai
      .ofType("response.create")
      .filter((e) => JSON.stringify(e).includes(POC_CAP_FAREWELL));
    expect(farewells.length).toBe(1);
    // Frames after the cap no longer relay.
    const appended = openai.ofType("input_audio_buffer.append").length;
    await twilio.emitMedia(30);
    expect(openai.ofType("input_audio_buffer.append").length).toBe(appended);
  });

  it("hangs up with the farewell at the $5 cost cap", async () => {
    const { twilio, openai, hangups, session } = makeSession();
    // One authoritative usage event worth ~$5.04 of output audio (1260s × $0.24/min), then the
    // next relayed frame triggers enforcement via the meter.
    await openai.emit({
      type: "response.done",
      response: { usage: { output_token_details: { audio_tokens: 12_600 } } },
    });
    await twilio.emitMedia(0.02);

    expect(hangups).toEqual(["cost_cap"]);
    expect(session.capReason).toBe("cost_cap");
    expect(session.cost.microCents).toBeGreaterThanOrEqual(REALTIME_COST_CAP_MICRO_CENTS);
    const farewells = openai
      .ofType("response.create")
      .filter((e) => JSON.stringify(e).includes(POC_CAP_FAREWELL));
    expect(farewells.length).toBe(1);
  });

  it("cap constants match the lock (30 min, $5)", () => {
    expect(REALTIME_WALL_CAP_SECONDS).toBe(1800);
    expect(REALTIME_COST_CAP_MICRO_CENTS).toBe(5_000_000);
  });
});

// ── Cost math ────────────────────────────────────────────────────────────────────────────────────

describe("realtime cost meter", () => {
  it("prices relayed audio as an estimate and settles on usage events without double counting", () => {
    const meter = new RealtimeCostMeter();
    meter.addInboundAudio(60); // $0.06 + Twilio $0.013 on the elapsed minute
    const estimated = meter.snapshot().microCents;
    expect(estimated).toBe(73_000); // (0.06 + 0.013) USD → micro-cents

    meter.addUsage(600, 0); // the same 60s, now authoritative
    const settled = meter.snapshot().microCents;
    expect(settled).toBe(73_000); // unchanged — settled replaces the estimate, not adds to it
  });

  it("µ-law base64 → seconds (8000 bytes/s)", () => {
    const oneSecond = Buffer.alloc(8000).toString("base64");
    expect(mulawBase64Seconds(oneSecond)).toBeCloseTo(1, 2); // base64 padding ≈ +1 byte of slop
  });

  it("estimates a whole call from billed duration", () => {
    // 60s: in 30s ($0.03) + out 30s ($0.12) + twilio 60s ($0.013) = $0.163 → 163_000 µ¢
    expect(estimateRealtimeCallMicroCents(60)).toBe(163_000);
  });
});

// ── Caller gate + webhook classification ────────────────────────────────────────────────────────

const BASE_CONFIG: VoiceConnectionConfig = {
  accountSid: "AC123",
  voiceId: "v",
  pool: "own",
  numberSid: null,
  maxCallSeconds: null,
  callerNumber: "+14045550000",
  allowUnknownCallers: false,
  allowedCallers: ["+14045551111"],
  dailyCallCap: null,
};

describe("voice caller gate (PA-CHAN-15)", () => {
  it("allows the owner's verified number and explicit allow-list entries", () => {
    expect(isCallerAllowed(BASE_CONFIG, "+14045550000")).toBe(true);
    expect(isCallerAllowed(BASE_CONFIG, "+14045551111")).toBe(true);
  });
  it("declines an unknown caller unless the owner opted into cold-inbound", () => {
    expect(isCallerAllowed(BASE_CONFIG, "+19998887777")).toBe(false);
    expect(isCallerAllowed({ ...BASE_CONFIG, allowUnknownCallers: true }, "+19998887777")).toBe(true);
  });
  it("declines an empty From", () => {
    expect(isCallerAllowed({ ...BASE_CONFIG, allowUnknownCallers: false }, "")).toBe(false);
  });
});

describe("voice webhook classification", () => {
  it("classifies a ringing call and ignores post-live statuses", () => {
    const body = "CallSid=CA1&AccountSid=AC1&From=%2B14045550000&To=%2B14045559999&CallStatus=ringing";
    const params = VoiceWebhookSchema.parse(decodeVoiceWebhookBody(body));
    expect(classifyVoiceWebhook(params)).toEqual({
      kind: "call",
      callSid: "CA1",
      from: "+14045550000",
      to: "+14045559999",
    });
    expect(classifyVoiceWebhook({ ...params, CallStatus: "completed" }).kind).toBe("ignore");
  });

  it("verifies and rejects Twilio signatures for the inbound voice URL", () => {
    const url = "https://aipocketagent.com/api/channels/inbound/voice";
    const params = { CallSid: "CA1", From: "+14045550000", To: "+14045559999", AccountSid: "AC1" };
    const signature = computeTwilioSignature("token-123", url, params);
    expect(verifyTwilioSignature({ authToken: "token-123", url, params, signature })).toBe(true);
    expect(verifyTwilioSignature({ authToken: "token-123", url, params, signature: "forged" })).toBe(false);
    expect(verifyTwilioSignature({ authToken: "wrong-token", url, params, signature })).toBe(false);
    expect(verifyTwilioSignature({ authToken: "token-123", url, params, signature: null })).toBe(false);
  });
});

// ── Realtime event parsing ───────────────────────────────────────────────────────────────────────

describe("realtime event parsing", () => {
  it("parses the consumed event kinds and ignores novelty", () => {
    expect(parseRealtimeEvent(JSON.stringify({ type: "response.output_audio.delta", delta: "QUJD" }))).toEqual({
      kind: "audio_delta",
      base64Mulaw: "QUJD",
    });
    expect(parseRealtimeEvent(JSON.stringify({ type: "session.created" }))).toEqual({ kind: "ignored" });
    expect(parseRealtimeEvent("not json").kind).toBe("error");
  });

  it("validates function args per tool and rejects junk", () => {
    expect(parseFunctionArgs("send_email", '{"to":"a@b.c","subject":"s","body":"b"}')).toEqual({
      to: "a@b.c",
      subject: "s",
      body: "b",
    });
    expect(parseFunctionArgs("send_email", '{"to":"a@b.c"}')).toBeNull();
    expect(parseFunctionArgs("schedule_meeting", "{{{")).toBeNull();
  });
});

// ── Poc prompt voice-check (the bio is a build gate, not a suggestion) ───────────────────────────

describe("poc realtime prompt", () => {
  const inbound = buildPocRealtimeInstructions({
    direction: "inbound",
    ownerName: "Chase",
    businessContext: "- Pricing sheet\n- Services list",
  });
  const outbound = buildPocRealtimeInstructions({
    direction: "outbound",
    ownerName: "Chase",
    businessContext: "",
    purpose: "confirm Thursday's delivery",
  });

  it("opens inbound calls with the canonical greeting and carries the approval rule", () => {
    expect(inbound).toContain(POC_INBOUND_GREETING("Chase"));
    expect(inbound).toContain("staged for Chase's approval");
    expect(inbound).toContain("Nothing sends, books, or fires from this call");
  });

  it("outbound calls carry the owner's purpose and the speak-as-Poc contract", () => {
    expect(outbound).toContain("confirm Thursday's delivery");
    expect(outbound).toContain("may feed you lines mid-call");
  });

  it("the instruction body teaches the banned list; canned lines never violate it", () => {
    for (const phrase of POC_BANNED_PHRASES) {
      expect(inbound.toLowerCase()).toContain(phrase); // taught as "never say"
    }
    const canned = [POC_INBOUND_GREETING("Chase"), POC_CAP_FAREWELL, POC_DECLINE_UNKNOWN_CALLER];
    for (const line of canned) {
      for (const phrase of POC_BANNED_PHRASES) {
        expect(line.toLowerCase()).not.toContain(phrase);
      }
      expect(line).not.toContain("!");
    }
  });
});
