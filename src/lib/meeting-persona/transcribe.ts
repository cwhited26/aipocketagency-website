// meeting-persona/transcribe.ts — the streaming transcription orchestrator (Meeting Persona,
// MP-CORE-2). Wires Recall.ai bot audio → Deepgram live transcription → pa_meeting_transcripts,
// with a debounced brain write on finals + a final write on shutdown.
//
// SCOPE: this is the pipeline primitive. The end-to-end "spawn bot → stream → write on bot.left"
// wiring is MP-CORE-3 (it also decides runtime placement — a long-lived socket belongs in the Modal
// runtime, not a Vercel serverless function). This module is structured so that placement layer just
// calls start/stop.
//
// AUDIO-SOURCE GAP (documented): a Recall bot only exposes a real-time audio endpoint when spawned
// with a real-time config, which MP-CORE-1's spawn does not yet send. So getBotAudioStreamUrl returns
// null for current bots → audioSource:"stubbed": the Deepgram socket opens (real, metered-ready) but
// the audio pipe stays unconnected. MP-CORE-3 must add the real-time config at spawn (or use Recall's
// native Deepgram passthrough). Surfaced, not silent.

import { fetchDeepgramConnectionFull } from "@/lib/connectors/deepgram/db";
import { decryptDeepgramKey, DeepgramKeyDecryptionError } from "@/lib/connectors/deepgram/key";
import {
  openLiveTranscriptionSocket,
  parseDeepgramResult,
  type LiveTranscriptionSocket,
} from "@/lib/connectors/deepgram/client";
import {
  fetchMeetingSessionById,
  fetchRecallConnectionFull,
} from "@/lib/connectors/recall-ai/db";
import { getBotAudioStreamUrl } from "@/lib/connectors/recall-ai/client";
import { decryptRecallKey, RecallKeyDecryptionError } from "@/lib/crypto/recall-key";
import { appendTranscriptChunk } from "./db";
import { writeTranscriptToBrain } from "./brain-write";
import { log } from "./log";

const BRAIN_WRITE_DEBOUNCE_MS = 15_000;

type StreamHandle = {
  sessionId: string;
  socket: LiveTranscriptionSocket;
  audioSocket: WebSocket | null;
  chunkSeq: number;
  brainWriteTimer: ReturnType<typeof setTimeout> | null;
  audioSource: "recall" | "stubbed";
};

// Module-level registry of open streams → idempotency. "reserving" is a synchronous placeholder set
// the instant a start begins, so a concurrent/repeat start for the same session short-circuits before
// any socket is opened.
const activeStreams = new Map<string, StreamHandle | "reserving">();

export type StartResult =
  | { ok: true; alreadyRunning: boolean; audioSource: "recall" | "stubbed" }
  | { ok: false; status: number; error: string };

/** True when a transcription stream is open (or reserving) for the session. */
export function isTranscriptionStreamActive(sessionId: string): boolean {
  return activeStreams.has(sessionId);
}

function scheduleBrainWrite(handle: StreamHandle): void {
  if (handle.brainWriteTimer) clearTimeout(handle.brainWriteTimer);
  handle.brainWriteTimer = setTimeout(() => {
    void writeTranscriptToBrain({ sessionId: handle.sessionId }).then((r) => {
      if (!r.ok) {
        log.error("debounced brain write failed", { session_id: handle.sessionId, error: r.error });
      }
    });
  }, BRAIN_WRITE_DEBOUNCE_MS);
}

function wireDeepgramHandlers(handle: StreamHandle): void {
  handle.socket.socket.addEventListener("message", (ev: MessageEvent) => {
    const raw = typeof ev.data === "string" ? ev.data : null;
    if (!raw) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    const chunk = parseDeepgramResult(parsed);
    if (!chunk) return;
    const seq = handle.chunkSeq++;
    void appendTranscriptChunk({
      sessionId: handle.sessionId,
      chunkSeq: seq,
      speakerLabel: chunk.speakerLabel,
      text: chunk.text,
      startMs: chunk.startMs,
      endMs: chunk.endMs,
      confidence: chunk.confidence,
      isFinal: chunk.isFinal,
    }).then((r) => {
      if (!r.ok) log.error("appendTranscriptChunk failed", { session_id: handle.sessionId, error: r.error });
    });
    if (chunk.isFinal) scheduleBrainWrite(handle);
  });

  handle.socket.socket.addEventListener("close", () => {
    log.info("deepgram socket closed", { session_id: handle.sessionId });
    activeStreams.delete(handle.sessionId);
  });
  handle.socket.socket.addEventListener("error", () => {
    log.error("deepgram socket error", { session_id: handle.sessionId });
  });
}

/**
 * Open a transcription stream for a meeting session. Idempotent — a second call while a stream is
 * open (or reserving) returns { alreadyRunning: true } without opening another socket.
 */
export async function startTranscriptionStream(input: {
  sessionId: string;
  recallBotId: string;
}): Promise<StartResult> {
  const existing = activeStreams.get(input.sessionId);
  if (existing) {
    return {
      ok: true,
      alreadyRunning: true,
      audioSource: existing === "reserving" ? "stubbed" : existing.audioSource,
    };
  }
  // Reserve the slot synchronously so a re-entry before the awaits resolve short-circuits above.
  activeStreams.set(input.sessionId, "reserving");

  try {
    const session = await fetchMeetingSessionById(input.sessionId);
    if (!session.ok) return fail(input.sessionId, session.status, session.error);
    if (!session.data) return fail(input.sessionId, 404, "Meeting session not found.");

    const dgConn = await fetchDeepgramConnectionFull(session.data.owner_id);
    if (!dgConn.ok) return fail(input.sessionId, dgConn.status, dgConn.error);
    if (!dgConn.data) {
      return fail(input.sessionId, 409, "Connect Deepgram in Settings → Connections before transcribing.");
    }

    let deepgramKey: string;
    try {
      deepgramKey = decryptDeepgramKey(dgConn.data.apiKeyEncrypted);
    } catch (e) {
      if (e instanceof DeepgramKeyDecryptionError) {
        return fail(input.sessionId, 401, "Deepgram key unreadable — reconnect Deepgram.");
      }
      throw e;
    }

    // Resolve the Recall bot's audio source (best-effort; null = the documented stub case).
    let audioUrl: string | null = null;
    const recallConn = await fetchRecallConnectionFull(session.data.owner_id);
    if (recallConn.ok && recallConn.data) {
      try {
        const recallKey = decryptRecallKey(recallConn.data.apiKeyEncrypted);
        const audio = await getBotAudioStreamUrl({ botId: input.recallBotId, apiKey: recallKey });
        if (audio.ok) audioUrl = audio.data;
        else log.warn("could not resolve Recall audio stream", { session_id: input.sessionId, error: audio.error });
      } catch (e) {
        if (!(e instanceof RecallKeyDecryptionError)) throw e;
        log.warn("Recall key unreadable — audio source stubbed", { session_id: input.sessionId });
      }
    } else {
      log.warn("no Recall connection — audio source stubbed", { session_id: input.sessionId });
    }

    const socket = openLiveTranscriptionSocket({ apiKey: deepgramKey });
    const handle: StreamHandle = {
      sessionId: input.sessionId,
      socket,
      audioSocket: null,
      chunkSeq: 0,
      brainWriteTimer: null,
      audioSource: audioUrl ? "recall" : "stubbed",
    };
    wireDeepgramHandlers(handle);

    if (audioUrl) {
      // Recall pushes audio frames; forward each to Deepgram.
      const audioSocket = new WebSocket(audioUrl);
      audioSocket.binaryType = "arraybuffer";
      audioSocket.addEventListener("message", (ev: MessageEvent) => {
        if (ev.data instanceof ArrayBuffer) socket.sendAudio(ev.data);
      });
      audioSocket.addEventListener("close", () => socket.finish());
      handle.audioSocket = audioSocket;
    } else {
      log.warn("audio source stubbed — Deepgram socket open, no audio piped (MP-CORE-3 wires spawn config)", {
        session_id: input.sessionId,
        recall_bot_id: input.recallBotId,
      });
    }

    activeStreams.set(input.sessionId, handle);
    log.info("transcription stream started", { session_id: input.sessionId, audio_source: handle.audioSource });
    return { ok: true, alreadyRunning: false, audioSource: handle.audioSource };
  } catch (e) {
    activeStreams.delete(input.sessionId);
    throw e;
  }
}

function fail(sessionId: string, status: number, error: string): StartResult {
  activeStreams.delete(sessionId);
  return { ok: false, status, error };
}

/**
 * Stop a session's transcription stream and write the final transcript to brain. Safe to call when
 * no stream is open (still writes whatever finals were persisted). Triggered by MP-CORE-1's webhook
 * on bot.left (wired in MP-CORE-3).
 */
export async function stopTranscriptionStream(input: { sessionId: string }): Promise<void> {
  const handle = activeStreams.get(input.sessionId);
  if (handle && handle !== "reserving") {
    if (handle.brainWriteTimer) clearTimeout(handle.brainWriteTimer);
    try {
      handle.socket.finish();
      handle.socket.close();
      handle.audioSocket?.close();
    } catch (e) {
      log.warn("stop: socket close threw", { session_id: input.sessionId, error: e instanceof Error ? e.message : String(e) });
    }
  }
  activeStreams.delete(input.sessionId);

  const written = await writeTranscriptToBrain({ sessionId: input.sessionId });
  if (!written.ok) {
    log.error("stop: final brain write failed", { session_id: input.sessionId, error: written.error });
  }
}

// Test-only: reset the in-memory registry between cases.
export function __resetActiveStreamsForTest(): void {
  activeStreams.clear();
}
