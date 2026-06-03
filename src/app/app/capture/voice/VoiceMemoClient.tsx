"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Status =
  | "idle"
  | "recording"
  | "transcribing"
  | "review"
  | "saving"
  | "saved"
  | "error";

function pickMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  if (typeof MediaRecorder === "undefined") return "";
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

export default function VoiceMemoClient({ hasBrain }: { hasBrain: boolean }) {
  const [status, setStatus] = useState<Status>("idle");
  const [topic, setTopic] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedPath, setSavedPath] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // The recorded audio is kept here so a failed transcription can retry without
  // making the user record again.
  const audioRef = useRef<Blob | null>(null);
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

  // Clean up on unmount.
  useEffect(() => {
    return () => {
      stopTimer();
      releaseStream();
    };
  }, [stopTimer, releaseStream]);

  const saveTranscript = useCallback(
    async (text: string, durationSeconds: number, topicValue: string) => {
      setStatus("saving");
      setErrorMsg(null);
      try {
        const res = await fetch("/api/app/voice/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript: text, topic: topicValue, durationSeconds }),
        });
        const body = (await res.json().catch(() => ({}))) as { error?: string; path?: string };
        if (!res.ok) {
          throw new Error(body.error ?? `Save failed (${res.status})`);
        }
        setSavedPath(body.path ?? null);
        setStatus("saved");
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Save failed");
        setStatus("error");
      }
    },
    [],
  );

  const transcribe = useCallback(async (blob: Blob) => {
    setStatus("transcribing");
    setErrorMsg(null);
    try {
      const form = new FormData();
      form.append("file", blob, "voice-memo.webm");
      const res = await fetch("/api/app/voice/transcribe", { method: "POST", body: form });
      const body = (await res.json().catch(() => ({}))) as { error?: string; text?: string };
      if (!res.ok || !body.text) {
        throw new Error(body.error ?? `Transcription failed (${res.status})`);
      }
      setTranscript(body.text);
      setStatus("review");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Transcription failed");
      setStatus("error");
    }
  }, []);

  const startRecording = useCallback(async () => {
    setErrorMsg(null);
    setTranscript("");
    setSavedPath(null);
    audioRef.current = null;

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setErrorMsg("This browser can't record audio. Try Safari or Chrome on your phone.");
      setStatus("error");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      const denied = e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "SecurityError");
      setErrorMsg(
        denied
          ? "Microphone access is blocked. Enable it in your browser settings and tap record again."
          : e instanceof Error
            ? `Couldn't start the microphone: ${e.message}`
            : "Couldn't start the microphone.",
      );
      setStatus("error");
      return;
    }

    streamRef.current = stream;
    chunksRef.current = [];
    const mimeType = pickMimeType();
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    recorderRef.current = recorder;

    recorder.ondataavailable = (ev: BlobEvent) => {
      if (ev.data.size > 0) chunksRef.current.push(ev.data);
    };
    recorder.onstop = () => {
      releaseStream();
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      audioRef.current = blob;
      if (blob.size === 0) {
        setErrorMsg("The recording was empty. Try again.");
        setStatus("error");
        return;
      }
      void transcribe(blob);
    };

    setElapsed(0);
    durationRef.current = 0;
    recorder.start();
    setStatus("recording");
    timerRef.current = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        durationRef.current = next;
        return next;
      });
    }, 1000);
  }, [releaseStream, transcribe]);

  const stopRecording = useCallback(() => {
    stopTimer();
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
  }, [stopTimer]);

  const retry = useCallback(() => {
    // A transcript already exists → only the save step failed; re-save it.
    if (transcript) {
      void saveTranscript(transcript, durationRef.current, topic);
      return;
    }
    // We still have the audio → re-run transcription without re-recording.
    if (audioRef.current) {
      void transcribe(audioRef.current);
      return;
    }
    // Nothing to retry from → back to idle.
    setStatus("idle");
    setErrorMsg(null);
  }, [transcript, topic, saveTranscript, transcribe]);

  const reset = useCallback(() => {
    audioRef.current = null;
    durationRef.current = 0;
    setTranscript("");
    setSavedPath(null);
    setErrorMsg(null);
    setElapsed(0);
    setTopic("");
    setStatus("idle");
  }, []);

  const canRetryAudio = Boolean(audioRef.current) || Boolean(transcript);

  return (
    <div className="h-full overflow-y-auto bg-[#06080b]">
      <div className="max-w-xl mx-auto px-6 py-8 flex flex-col gap-6">
        {/* Header */}
        <div>
          <div className="text-[#22d3ee] text-[10px] font-mono tracking-[0.22em] uppercase mb-1.5">
            Pocket Agent · Capture
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Voice memo.</h1>
          <p className="text-slate-400 text-sm mt-1.5 leading-relaxed">
            Tap record and talk. Pocket Agent transcribes it and files it in your brain&apos;s
            Capture Inbox — hands-free.
          </p>
        </div>

        {!hasBrain ? (
          <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 px-5 py-5 space-y-2">
            <p className="text-sm font-medium text-slate-300">No brain connected yet.</p>
            <p className="text-sm text-slate-400">
              Set up your brain repo first, then come back to record.
            </p>
            <a
              href="/app/onboarding"
              className="inline-block text-sm text-[#22d3ee] hover:underline font-mono"
            >
              Set up brain →
            </a>
          </div>
        ) : (
          <>
            {/* Topic input — editable before or after recording, until saved. */}
            <div>
              <label
                htmlFor="voice-topic"
                className="text-[10px] font-mono text-slate-500 tracking-[0.15em] uppercase"
              >
                Topic (optional)
              </label>
              <input
                id="voice-topic"
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={status === "saving" || status === "saved"}
                placeholder="e.g. patrick call notes"
                className="mt-1.5 w-full rounded-xl border border-slate-700/60 bg-slate-900/70 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-[#22d3ee]/40 disabled:opacity-50"
              />
            </div>

            {/* Recorder */}
            <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 px-6 py-8 flex flex-col items-center gap-5">
              {/* Timer */}
              <div
                className="font-mono text-4xl tabular-nums"
                style={{ color: status === "recording" ? "#f87171" : "#475569" }}
              >
                {formatElapsed(elapsed)}
              </div>

              {/* Big button */}
              {status === "recording" ? (
                <button
                  onClick={stopRecording}
                  aria-label="Stop recording"
                  className="relative h-24 w-24 rounded-full bg-red-500/15 border-2 border-red-500/60 flex items-center justify-center transition-transform active:scale-95"
                >
                  <span className="absolute inset-0 rounded-full border-2 border-red-500/40 animate-ping" />
                  <span className="h-8 w-8 rounded-md bg-red-400" />
                </button>
              ) : status === "transcribing" || status === "saving" ? (
                <div className="h-24 w-24 rounded-full bg-slate-800/40 border-2 border-[#22d3ee]/30 flex items-center justify-center">
                  <span className="font-mono text-[10px] text-[#22d3ee]/70 animate-pulse text-center px-2">
                    {status === "transcribing" ? "transcribing…" : "saving…"}
                  </span>
                </div>
              ) : (
                <button
                  onClick={() => void startRecording()}
                  disabled={status === "review"}
                  aria-label="Start recording"
                  className="h-24 w-24 rounded-full bg-[#22d3ee]/10 border-2 border-[#22d3ee]/50 flex items-center justify-center transition-transform active:scale-95 hover:bg-[#22d3ee]/15 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span className="h-10 w-10 rounded-full bg-[#22d3ee]" />
                </button>
              )}

              <p className="text-xs text-slate-500 font-mono">
                {status === "recording"
                  ? "Recording — tap to stop"
                  : status === "transcribing"
                    ? "Converting speech to text"
                    : status === "saving"
                      ? "Writing to your brain"
                      : status === "review"
                        ? "Review below, then save"
                        : "Tap to start"}
              </p>
            </div>

            {/* Error */}
            {status === "error" && errorMsg && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/8 px-4 py-4 space-y-3">
                <p className="text-sm font-medium text-red-300">{errorMsg}</p>
                {canRetryAudio && (
                  <p className="text-xs text-slate-400">
                    Your recording is still here on this device — retry won&apos;t re-record.
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={retry}
                    className="rounded-lg bg-[#22d3ee]/15 border border-[#22d3ee]/40 px-4 py-2 text-xs font-mono text-[#22d3ee] hover:bg-[#22d3ee]/25 transition-colors"
                  >
                    {canRetryAudio ? "Retry" : "Start over"}
                  </button>
                  {canRetryAudio && (
                    <button
                      onClick={reset}
                      className="rounded-lg border border-slate-700/60 px-4 py-2 text-xs font-mono text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      Discard
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Review */}
            {status === "review" && (
              <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 px-4 py-4 space-y-3">
                <p className="text-[10px] font-mono text-slate-500 tracking-[0.15em] uppercase">
                  Transcript
                </p>
                <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                  {transcript}
                </p>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => void saveTranscript(transcript, durationRef.current, topic)}
                    className="rounded-lg bg-[#22d3ee]/15 border border-[#22d3ee]/40 px-4 py-2.5 text-sm font-medium text-[#22d3ee] hover:bg-[#22d3ee]/25 transition-colors"
                  >
                    Save to brain
                  </button>
                  <button
                    onClick={reset}
                    className="rounded-lg border border-slate-700/60 px-4 py-2.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    Discard
                  </button>
                </div>
              </div>
            )}

            {/* Saved */}
            {status === "saved" && (
              <div className="rounded-xl border border-[#22d3ee]/30 bg-[#22d3ee]/6 px-4 py-4 space-y-3">
                <p className="text-sm font-medium text-[#22d3ee]">Filed in your brain.</p>
                {savedPath && (
                  <p className="text-[11px] font-mono text-slate-500 break-all">→ {savedPath}</p>
                )}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={reset}
                    className="rounded-lg bg-[#22d3ee]/15 border border-[#22d3ee]/40 px-4 py-2.5 text-sm font-medium text-[#22d3ee] hover:bg-[#22d3ee]/25 transition-colors"
                  >
                    Record another
                  </button>
                  <a
                    href="/app/brain/inbox"
                    className="rounded-lg border border-slate-700/60 px-4 py-2.5 text-sm text-slate-400 hover:text-slate-200 transition-colors flex items-center"
                  >
                    View Capture Inbox →
                  </a>
                </div>
              </div>
            )}

            {/* Footer link */}
            <div className="border-t border-slate-800/40 pt-4">
              <a
                href="/app/capture"
                className="text-xs text-slate-600 hover:text-slate-400 transition-colors font-mono"
              >
                ← Capture (upload files)
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
