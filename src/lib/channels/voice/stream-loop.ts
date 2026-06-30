// lib/channels/voice/stream-loop.ts — the STT → dispatcher → TTS loop, over an abstract VoiceSocket.
//
// Twilio Media Streams need a persistent bidirectional WebSocket, which Vercel serverless/fluid
// functions cannot host. So the loop is written against a transport-agnostic VoiceSocket interface: a
// standalone long-lived Node service (documented in docs/voice-call/handoff.md) opens a `ws` server,
// adapts each Twilio Media Stream connection to a VoiceSocket, and drives a VoiceCallSession. That
// keeps the whole loop unit-testable with a fake socket and free of the `ws` dependency (not in the
// repo). The /api/channels/voice/stream route returns a 426 pointing at that service.
//
// The session uses the cumulative audio clock (inbound frame ms + spoken seconds) as the cap basis —
// no Date.now() — so the per-tier ceiling is enforced deterministically and the loop stays testable.

import { CAP_HANGUP_REPLY } from "./profile";
import type { SpokenAudio } from "./tts";
import type { VoiceTranscriber } from "./stt";
import type { VoiceTurnResult, VoiceTurnState } from "./dispatcher-voice";
import { initialVoiceTurnState } from "./dispatcher-voice";

/** The Twilio Media Stream connection, abstracted so the loop is transport-agnostic + testable. */
export interface VoiceSocket {
  /** Register the inbound-audio handler. `frameMs` is the frame's duration (Twilio default ~20 ms). */
  onMedia(handler: (mulawFrame: Buffer, frameMs: number) => void | Promise<void>): void;
  /** Register the stream-stopped handler (caller hung up / Twilio closed the stream). */
  onStop(handler: () => void | Promise<void>): void;
  /** Write base64 µ-law frames back to the caller (Twilio `media` messages). */
  sendFrames(base64Frames: string[]): void;
  /** Close the stream (e.g. after the cap-hangup message). `reason` is logged. */
  close(reason: string): void;
}

export type VoiceSessionDeps = {
  transcriber: VoiceTranscriber;
  /** Synthesize spoken audio for reply text (wraps tts.speak with the persona's voice id). */
  speak: (text: string) => Promise<SpokenAudio>;
  /** Decide + perform one turn (wraps handleVoiceTurn with the persona/dispatcher wiring). */
  handleTurn: (transcript: string, state: VoiceTurnState) => Promise<VoiceTurnResult>;
  /** Hard ceiling in seconds for this call (resolveVoiceCeiling). 0 = refuse before the greeting. */
  ceilingSeconds: number;
  /** The opening line spoken on answer (voiceProfile.greeting). */
  greeting: string;
  /** Per-turn hook: transcript + spoken reply + staged flag — for the full-transcript trail + logs. */
  onTurn?: (turn: { transcript: string; reply: string; staged: boolean; executed: boolean }) => void;
  /** Fired once when the cap-hangup path triggers. */
  onCapReached?: () => void;
};

/**
 * Drive one voice call to completion over the socket. Returns when the stream stops, exposing the
 * accumulated transcript + audio seconds for the status webhook to finalize the pa_voice_calls row.
 */
export class VoiceCallSession {
  private readonly socket: VoiceSocket;
  private readonly deps: VoiceSessionDeps;
  private turnState: VoiceTurnState = initialVoiceTurnState();
  private inboundMs = 0;
  private spokenSeconds = 0;
  private busy = false;
  private capped = false;
  private stopped = false;
  private readonly transcriptParts: string[] = [];

  constructor(socket: VoiceSocket, deps: VoiceSessionDeps) {
    this.socket = socket;
    this.deps = deps;
  }

  /** Cumulative audio seconds (inbound + spoken) — the cap basis. */
  get elapsedSeconds(): number {
    return this.inboundMs / 1000 + this.spokenSeconds;
  }

  /** The call transcript so far (turns joined newest-last). */
  get transcript(): string {
    return this.transcriptParts.join("\n");
  }

  /** Begin the call: refuse-then-hangup if the cap is already exhausted, else speak the greeting. */
  async start(): Promise<void> {
    this.socket.onMedia((frame, ms) => this.onMediaFrame(frame, ms));
    this.socket.onStop(() => {
      this.stopped = true;
    });

    if (this.deps.ceilingSeconds <= 0) {
      await this.sayAndHangup(CAP_HANGUP_REPLY, "cap_exhausted_on_answer");
      return;
    }
    await this.say(this.deps.greeting);
  }

  private async onMediaFrame(frame: Buffer, frameMs: number): Promise<void> {
    if (this.stopped || this.capped) return;
    this.inboundMs += frameMs;

    if (this.elapsedSeconds >= this.deps.ceilingSeconds) {
      this.deps.onCapReached?.();
      await this.sayAndHangup(CAP_HANGUP_REPLY, "minute_cap_reached");
      return;
    }

    const turnReady = this.deps.transcriber.addFrame(frame, frameMs);
    if (turnReady && !this.busy) await this.processTurn();
  }

  private async processTurn(): Promise<void> {
    this.busy = true;
    try {
      const { text } = await this.deps.transcriber.takeTurn();
      if (text.trim() === "") return;

      const result = await this.deps.handleTurn(text, this.turnState);
      this.turnState = result.state;
      this.transcriptParts.push(`Caller: ${text}`);
      if (result.spokenText.trim() !== "") {
        this.transcriptParts.push(`Agent: ${result.spokenText}`);
      }
      this.deps.onTurn?.({
        transcript: text,
        reply: result.spokenText,
        staged: result.staged,
        executed: result.executed,
      });
      if (result.spokenText.trim() !== "" && !this.stopped && !this.capped) {
        await this.say(result.spokenText);
      }
    } finally {
      this.busy = false;
    }
  }

  private async say(text: string): Promise<void> {
    const audio = await this.deps.speak(text);
    this.spokenSeconds += audio.audioSeconds;
    if (!this.stopped) this.socket.sendFrames(audio.frames);
  }

  private async sayAndHangup(text: string, reason: string): Promise<void> {
    this.capped = true;
    try {
      await this.say(text);
    } finally {
      this.socket.close(reason);
    }
  }
}
