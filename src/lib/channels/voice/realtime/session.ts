// lib/channels/voice/realtime/session.ts — the realtime bridge: Twilio Media Stream ↔ OpenAI
// Realtime, with every consequential action approval-gated (PA-CHAN-15/16).
//
// Written against two abstract sockets — the shipped VoiceSocket (stream-loop.ts, the Twilio side)
// and RealtimeSocket (the OpenAI side) — for the same reason stream-loop.ts is: Vercel can't host
// the WS server, so the live transport runs in the standalone Node service (docs/voice-call/
// handoff.md §v2) and this whole session stays unit-testable with fakes. Audio relays verbatim:
// both sides speak g711_ulaw 8 kHz, no transcoding.
//
// The approval gate is structural, not prompt-side: the ONLY thing a function call can reach is
// deps.stageFunctionCall (an awaiting-approval inbox card). There is no execute path in this
// module — a jailbroken model output still can't fire an action, it can only stage one.

import { POC_CAP_FAREWELL, POC_REALTIME_TOOLS } from "./prompt";
import { isStagedFunctionName, parseFunctionArgs, parseRealtimeEvent } from "./messages";
import { mulawBase64Seconds, RealtimeCostMeter, type RealtimeCostSnapshot } from "./cost";
import { voiceLog } from "../log";
import type { VoiceSocket } from "../stream-loop";

/** The OpenAI Realtime WS, abstracted (standalone service adapts a real socket; tests use a fake). */
export interface RealtimeSocket {
  /** Send one client event (session.update, input_audio_buffer.append, response.create, …). */
  sendEvent(event: Record<string, unknown>): void;
  /** Register the server-event handler (raw JSON string per message). */
  onEvent(handler: (raw: string) => void | Promise<void>): void;
  close(reason: string): void;
}

export type TranscriptTurn = {
  role: "caller" | "poc" | "owner_line";
  text: string;
  /** Position on the call's audio clock, in whole ms. */
  atMs: number;
};

export type StagedCall = {
  name: string;
  args: Record<string, unknown>;
  stagedActionId: string | null;
  outcome: "staged" | "declined_malformed";
};

export type RealtimeSessionDeps = {
  /** The session instructions (buildPocRealtimeInstructions). */
  instructions: string;
  /** Inbound: Poc greets on connect. Outbound: Poc opens with the purpose. */
  openingResponse: boolean;
  /**
   * Stage one function call as an awaiting-approval inbox card. Returns the card id, or null when
   * staging failed (the model is told the truth either way). NEVER executes anything.
   */
  stageFunctionCall(name: string, args: Record<string, unknown>): Promise<string | null>;
  /** Append one event to the pa_voice_call_events ledger. Best-effort — must not throw. */
  recordEvent(type: "speech" | "function_call" | "approval_request", payload: Record<string, unknown>): void;
  /** End the underlying Twilio call (REST hangup). Fired once, after the farewell is queued. */
  hangupCall(reason: "wall_cap" | "cost_cap" | "remote_close"): Promise<void>;
  /** Poll the owner's speak-as-Poc queue (outbound listen-in). Empty array when none. Optional. */
  pollOwnerLines?(): Promise<string[]>;
};

const OWNER_LINE_POLL_EVERY_FRAMES = 100; // ~2 s of 20 ms frames between queue polls.

export class RealtimeBridgeSession {
  private readonly twilio: VoiceSocket;
  private readonly openai: RealtimeSocket;
  private readonly deps: RealtimeSessionDeps;
  private readonly meter = new RealtimeCostMeter();
  private readonly turns: TranscriptTurn[] = [];
  private readonly staged: StagedCall[] = [];
  private capTripped: "wall_cap" | "cost_cap" | null = null;
  private closed = false;
  private frameCount = 0;
  private pollingOwnerLines = false;

  constructor(twilioSocket: VoiceSocket, openaiSocket: RealtimeSocket, deps: RealtimeSessionDeps) {
    this.twilio = twilioSocket;
    this.openai = openaiSocket;
    this.deps = deps;
  }

  /** Wire both sockets and open the session. Resolves immediately; the sockets drive from here. */
  start(): void {
    this.openai.sendEvent({
      type: "session.update",
      session: {
        type: "realtime",
        instructions: this.deps.instructions,
        audio: {
          input: {
            format: { type: "audio/pcmu" },
            transcription: { model: "whisper-1" },
            turn_detection: { type: "server_vad" },
          },
          output: { format: { type: "audio/pcmu" } },
        },
        tools: [...POC_REALTIME_TOOLS],
        tool_choice: "auto",
      },
    });
    if (this.deps.openingResponse) {
      this.openai.sendEvent({ type: "response.create" });
    }

    this.openai.onEvent(async (raw) => {
      await this.handleRealtimeEvent(raw);
    });

    this.twilio.onMedia(async (mulawFrame, frameMs) => {
      if (this.closed || this.capTripped) return;
      this.meter.addInboundAudio(frameMs / 1000);
      this.openai.sendEvent({
        type: "input_audio_buffer.append",
        audio: mulawFrame.toString("base64"),
      });
      this.frameCount += 1;
      if (this.frameCount % OWNER_LINE_POLL_EVERY_FRAMES === 0) {
        await this.drainOwnerLines();
      }
      this.enforceCaps();
    });

    this.twilio.onStop(async () => {
      if (this.closed) return;
      this.closed = true;
      this.openai.close("twilio stream stopped");
      await this.deps.hangupCall("remote_close");
    });
  }

  private async handleRealtimeEvent(raw: string): Promise<void> {
    if (this.closed) return;
    const event = parseRealtimeEvent(raw);

    switch (event.kind) {
      case "audio_delta": {
        if (this.capTripped) return; // Farewell is the only audio allowed after a cap.
        this.meter.addOutboundAudio(mulawBase64Seconds(event.base64Mulaw));
        this.twilio.sendFrames([event.base64Mulaw]);
        this.enforceCaps();
        return;
      }
      case "assistant_transcript": {
        this.pushTurn("poc", event.text);
        return;
      }
      case "caller_transcript": {
        this.pushTurn("caller", event.text);
        return;
      }
      case "function_call": {
        await this.stageFunctionCall(event.callId, event.name, event.argumentsJson);
        return;
      }
      case "usage": {
        this.meter.addUsage(event.inputAudioTokens, event.outputAudioTokens);
        this.enforceCaps();
        return;
      }
      case "speech_started": {
        // Barge-in: the caller started talking over Poc — Twilio must drop buffered Poc audio.
        this.twilio.sendFrames([]);
        return;
      }
      case "error": {
        voiceLog.error("realtime session error event", { message: event.message });
        return;
      }
      case "ignored":
        return;
    }
  }

  /**
   * The approval gate. Validate the call, stage it as an inbox card, and hand the model an honest
   * tool result — "staged, awaiting approval" — so Poc's next line matches reality. Execution is
   * structurally impossible from here (PA-CHAN-16).
   */
  private async stageFunctionCall(callId: string, name: string, argumentsJson: string): Promise<void> {
    const respond = (output: string): void => {
      this.openai.sendEvent({
        type: "conversation.item.create",
        item: { type: "function_call_output", call_id: callId, output },
      });
      this.openai.sendEvent({ type: "response.create" });
    };

    if (!isStagedFunctionName(name)) {
      voiceLog.warn("realtime function call for unknown tool", { name });
      respond(JSON.stringify({ status: "declined", detail: "unknown tool" }));
      return;
    }
    const args = parseFunctionArgs(name, argumentsJson);
    if (args === null) {
      this.staged.push({ name, args: {}, stagedActionId: null, outcome: "declined_malformed" });
      respond(JSON.stringify({ status: "declined", detail: "malformed arguments — ask again" }));
      return;
    }

    this.deps.recordEvent("function_call", { name, args });
    const stagedActionId = await this.deps.stageFunctionCall(name, args);
    this.staged.push({ name, args, stagedActionId, outcome: "staged" });
    this.deps.recordEvent("approval_request", { name, stagedActionId });

    respond(
      JSON.stringify({
        status: "staged_for_approval",
        detail:
          "Drafted and waiting on the owner's sign-off in their inbox. Nothing was sent or booked. Tell the caller that, plainly.",
      }),
    );
  }

  /** Deliver queued owner lines (outbound listen-in: the owner types, Poc says it). */
  private async drainOwnerLines(): Promise<void> {
    if (!this.deps.pollOwnerLines || this.pollingOwnerLines || this.capTripped) return;
    this.pollingOwnerLines = true;
    try {
      const lines = await this.deps.pollOwnerLines();
      for (const line of lines) {
        this.pushTurn("owner_line", line);
        this.openai.sendEvent({
          type: "response.create",
          response: {
            instructions: `The owner just fed you this line to deliver now, naturally, as Poc: "${line}"`,
          },
        });
      }
    } finally {
      this.pollingOwnerLines = false;
    }
  }

  private enforceCaps(): void {
    if (this.capTripped || this.closed) return;
    const decision = this.meter.evaluateCaps();
    if (decision.ok) return;
    this.capTripped = decision.reason;
    voiceLog.info("realtime cap tripped", {
      reason: decision.reason,
      elapsedSeconds: Math.round(this.meter.elapsedSeconds),
      microCents: this.meter.snapshot().microCents,
    });
    // One farewell response, then the hangup. The audio_delta guard above keeps anything after
    // the farewell request from relaying if the model keeps talking.
    this.openai.sendEvent({
      type: "response.create",
      response: { instructions: `Say exactly this and nothing else: "${POC_CAP_FAREWELL}"` },
    });
    this.pushTurn("poc", POC_CAP_FAREWELL);
    void this.deps.hangupCall(decision.reason).then(() => {
      this.closed = true;
      this.openai.close(`cap: ${decision.reason}`);
      this.twilio.close(`cap: ${decision.reason}`);
    });
  }

  private pushTurn(role: TranscriptTurn["role"], text: string): void {
    const trimmed = text.trim();
    if (trimmed === "") return;
    const turn: TranscriptTurn = {
      role,
      text: trimmed,
      atMs: Math.round(this.meter.elapsedSeconds * 1000),
    };
    this.turns.push(turn);
    this.deps.recordEvent("speech", { role: turn.role, text: turn.text, at_ms: turn.atMs });
  }

  // ── Finalize accessors (the standalone service writes these to pa_voice_calls on stop) ────────

  get transcript(): readonly TranscriptTurn[] {
    return this.turns;
  }

  get stagedCalls(): readonly StagedCall[] {
    return this.staged;
  }

  get cost(): RealtimeCostSnapshot {
    return this.meter.snapshot();
  }

  get elapsedSeconds(): number {
    return this.meter.elapsedSeconds;
  }

  get capReason(): "wall_cap" | "cost_cap" | null {
    return this.capTripped;
  }
}
