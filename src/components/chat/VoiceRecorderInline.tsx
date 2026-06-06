"use client";

// VoiceRecorderInline — the chat-surface mic flow. Reuses the shipped Whisper capture
// pipeline (POST /api/app/voice/transcribe) and saves through POST /api/app/chat/voice,
// which commits the memo to the brain AND appends a voice_memo card to the chat history.
// On save it hands the new card message back to ChatHome to render inline.

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/chat/types";
import { CloseIcon } from "./icons";

type Status = "idle" | "recording" | "transcribing" | "review" | "saving" | "error";

function pickMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  if (typeof MediaRecorder === "undefined") return "";
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function VoiceRecorderInline({
  onSaved,
  onClose,
}: {
  onSaved: (card: ChatMessage) => void;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationRef = useRef(0);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);
  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => { stopTimer(); releaseStream(); }, [stopTimer, releaseStream]);

  const save = useCallback(
    async (text: string, durationSeconds: number) => {
      setStatus("saving");
      setErrorMsg(null);
      try {
        const res = await fetch("/api/app/chat/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript: text, durationSeconds }),
        });
        const body = (await res.json().catch(() => ({}))) as { error?: string; card?: ChatMessage };
        if (!res.ok || !body.card) throw new Error(body.error ?? `Save failed (${res.status})`);
        onSaved(body.card);
        onClose();
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Save failed");
        setStatus("error");
      }
    },
    [onSaved, onClose],
  );

  const transcribe = useCallback(async (blob: Blob) => {
    setStatus("transcribing");
    setErrorMsg(null);
    try {
      const form = new FormData();
      form.append("file", blob, "voice-memo.webm");
      const res = await fetch("/api/app/voice/transcribe", { method: "POST", body: form });
      const body = (await res.json().catch(() => ({}))) as { error?: string; text?: string };
      if (!res.ok || !body.text) throw new Error(body.error ?? `Transcription failed (${res.status})`);
      setTranscript(body.text);
      setStatus("review");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Transcription failed");
      setStatus("error");
    }
  }, []);

  const start = useCallback(async () => {
    setErrorMsg(null);
    setTranscript("");
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setErrorMsg("This browser can't record audio.");
      setStatus("error");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setErrorMsg("Microphone access is blocked. Enable it and try again.");
      setStatus("error");
      return;
    }
    streamRef.current = stream;
    chunksRef.current = [];
    const mime = pickMimeType();
    const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    recorderRef.current = recorder;
    recorder.ondataavailable = (ev: BlobEvent) => { if (ev.data.size > 0) chunksRef.current.push(ev.data); };
    recorder.onstop = () => {
      releaseStream();
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      if (blob.size === 0) { setErrorMsg("The recording was empty."); setStatus("error"); return; }
      void transcribe(blob);
    };
    setElapsed(0);
    durationRef.current = 0;
    recorder.start();
    setStatus("recording");
    timerRef.current = setInterval(() => {
      setElapsed((prev) => { const next = prev + 1; durationRef.current = next; return next; });
    }, 1000);
  }, [releaseStream, transcribe]);

  const stop = useCallback(() => {
    stopTimer();
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
  }, [stopTimer]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-slate-700/60 bg-[#0b1016] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center mb-4">
          <h3 className="text-sm font-semibold text-slate-100">Voice memo</h3>
          <button onClick={onClose} aria-label="Close" className="ml-auto text-slate-500 hover:text-slate-200">
            <CloseIcon />
          </button>
        </div>

        <div className="flex flex-col items-center gap-4">
          <div className="font-mono text-3xl tabular-nums" style={{ color: status === "recording" ? "#f87171" : "#475569" }}>
            {formatElapsed(elapsed)}
          </div>

          {status === "recording" ? (
            <button onClick={stop} aria-label="Stop" className="h-20 w-20 rounded-full bg-red-500/15 border-2 border-red-500/60 flex items-center justify-center active:scale-95 transition-transform">
              <span className="h-7 w-7 rounded-md bg-red-400" />
            </button>
          ) : status === "transcribing" || status === "saving" ? (
            <div className="h-20 w-20 rounded-full bg-slate-800/40 border-2 border-[#22d3ee]/30 flex items-center justify-center">
              <span className="font-mono text-[10px] text-[#22d3ee]/70 animate-pulse">
                {status === "transcribing" ? "transcribing…" : "saving…"}
              </span>
            </div>
          ) : status === "review" ? null : (
            <button onClick={() => void start()} aria-label="Record" className="h-20 w-20 rounded-full bg-[#22d3ee]/10 border-2 border-[#22d3ee]/50 flex items-center justify-center active:scale-95 hover:bg-[#22d3ee]/15 transition-transform">
              <span className="h-8 w-8 rounded-full bg-[#22d3ee]" />
            </button>
          )}

          {status === "error" && errorMsg && <p className="text-sm text-red-300 text-center">{errorMsg}</p>}

          {status === "review" && (
            <div className="w-full space-y-3">
              <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Transcript</p>
              <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto">{transcript}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => void save(transcript, durationRef.current)}
                  className="flex-1 rounded-lg bg-[#22d3ee]/15 border border-[#22d3ee]/40 px-4 py-2.5 text-sm font-medium text-[#22d3ee] hover:bg-[#22d3ee]/25 transition-colors"
                >
                  Add to chat
                </button>
                <button onClick={onClose} className="rounded-lg border border-slate-700/60 px-4 py-2.5 text-sm text-slate-400 hover:text-slate-200 transition-colors">
                  Discard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
