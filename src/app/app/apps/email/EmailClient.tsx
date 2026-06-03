"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Citation = { file: string; line: string };
type GenerateResponse = { draft: string; citations: Citation[]; hasBrain: boolean };
type Mode = "quick" | "detailed";

// ─── Minimal SpeechRecognition typing ───────────────────────────────────────────
// The DOM lib doesn't ship Web Speech types in this project, so declare just the
// surface we use. Avoids `any` while staying optional/feature-detected.
type SpeechResultEvent = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};
interface MinimalSpeechRecognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type SpeechRecognitionCtor = new () => MinimalSpeechRecognition;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const inputClass =
  "w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-[#22d3ee] focus:outline-none";

export default function EmailClient({
  brainRepo,
  hasApiKey,
}: {
  brainRepo: string | null;
  hasApiKey: boolean;
}) {
  const [mode, setMode] = useState<Mode>("quick");

  // Quick mode
  const [brief, setBrief] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef<MinimalSpeechRecognition | null>(null);

  // Detailed mode
  const [recipient, setRecipient] = useState("");
  const [relationship, setRelationship] = useState("");
  const [purpose, setPurpose] = useState("");
  const [keyPoints, setKeyPoints] = useState("");
  const [tone, setTone] = useState("");

  // Output
  const [draft, setDraft] = useState("");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [hasBrain, setHasBrain] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Staging to Inbox
  const [stageTo, setStageTo] = useState("");
  const [stageSubject, setStageSubject] = useState("");
  const [staging, setStaging] = useState(false);
  const [staged, setStaged] = useState(false);
  const [stageError, setStageError] = useState<string | null>(null);

  useEffect(() => {
    setVoiceSupported(getSpeechRecognitionCtor() !== null);
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  function toggleListening() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (e) => {
      const chunks: string[] = [];
      for (let i = 0; i < e.results.length; i++) {
        const alt = e.results[i][0];
        if (alt?.transcript) chunks.push(alt.transcript);
      }
      const text = chunks.join(" ").trim();
      if (text) setBrief((prev) => (prev ? `${prev.trim()} ${text}` : text));
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  const canSubmit =
    mode === "quick"
      ? brief.trim().length > 0
      : recipient.trim().length > 0 && purpose.trim().length > 0;

  async function handleGenerate() {
    if (!canSubmit || isLoading) return;
    if (listening) recognitionRef.current?.stop();
    setIsLoading(true);
    setError(null);
    setDraft("");
    setCitations([]);

    const payload =
      mode === "quick"
        ? { mode: "quick", brief: brief.trim() }
        : {
            mode: "detailed",
            recipient: recipient.trim(),
            relationship: relationship.trim(),
            purpose: purpose.trim(),
            keyPoints: keyPoints.trim(),
            tone: tone.trim(),
          };

    const res = await fetch("/api/app/apps/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => null);

    if (!res) {
      setError("Network error. Check your connection and try again.");
      setIsLoading(false);
      return;
    }

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (body.error === "no_api_key") {
        setError("no_api_key");
      } else {
        setError(body.message ?? body.error ?? "Something went wrong. Try again.");
      }
      setIsLoading(false);
      return;
    }

    const data = (await res.json()) as GenerateResponse;
    setDraft(data.draft);
    setCitations(data.citations);
    setHasBrain(data.hasBrain);
    // Reset staging for the fresh draft; prefill the recipient when we have one.
    setStaged(false);
    setStageError(null);
    setStageTo(mode === "detailed" ? recipient.trim() : "");
    setStageSubject("");
    setIsLoading(false);
  }

  async function handleStage() {
    if (!draft.trim() || staging) return;
    setStaging(true);
    setStageError(null);
    const res = await fetch("/api/app/inbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: stageTo.trim(),
        subject: stageSubject.trim(),
        body: draft,
        citations,
      }),
    }).catch(() => null);

    if (!res || !res.ok) {
      const body = (await res?.json().catch(() => ({}))) as { error?: string };
      setStageError(body?.error ?? "Couldn't stage the draft. Try again.");
      setStaging(false);
      return;
    }
    setStaged(true);
    setStaging(false);
  }

  async function handleCopy() {
    if (!draft) return;
    await navigator.clipboard.writeText(draft).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!hasApiKey) {
    return (
      <div className="h-full overflow-y-auto bg-[#05070a] flex flex-col items-center justify-center px-4">
        <div className="max-w-sm w-full space-y-4 text-center">
          <div className="text-[#22d3ee] text-xs font-mono tracking-[0.2em] uppercase">
            Setup required
          </div>
          <h2 className="text-xl font-bold text-slate-100">Add your Anthropic API key</h2>
          <p className="text-slate-400 text-sm">
            Pocket Agent uses your own Anthropic key — your data stays yours and you control the
            bill.
          </p>
          <Link
            href="/app/settings"
            className="inline-flex w-full items-center justify-center rounded-lg bg-[#22d3ee] px-5 py-3 text-sm font-semibold text-[#031820] hover:bg-[#06b6d4] transition-colors"
          >
            Go to Settings →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-[#05070a]">
      {/* pb clears the iOS Safari home-indicator so the CTA is never cut off */}
      <div
        className="max-w-2xl mx-auto px-6 py-10"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 2.5rem)" }}
      >
        <div className="mb-2">
          <Link
            href="/app/apps"
            className="text-xs text-slate-600 hover:text-slate-400 transition-colors font-mono"
          >
            ← Work apps
          </Link>
        </div>

        <div className="mb-6">
          <div className="text-[10px] text-[#22d3ee]/60 font-mono tracking-[0.2em] uppercase mb-2">
            Level 2 · Drafts in your voice
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Email Drafter</h1>
          <p className="text-slate-500 text-sm mt-2 leading-relaxed">
            {brainRepo
              ? `Reads your voice from ${brainRepo} and writes an email that sounds like you — not like AI.`
              : "No brain connected yet. Will draft a clean email from your inputs — just without your specific voice and client history. Connect a brain to make it sound like you."}
          </p>
        </div>

        {/* Mode toggle */}
        <div className="inline-flex rounded-xl border border-slate-700 bg-slate-900 p-1 mb-5">
          {(["quick", "detailed"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                mode === m
                  ? "bg-[#22d3ee] text-[#031820]"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {m === "quick" ? "Quick" : "Detailed"}
            </button>
          ))}
        </div>

        {mode === "quick" ? (
          <div className="space-y-3 mb-6">
            <label className="block text-xs font-medium text-slate-400">
              Just say what you need
            </label>
            <div className="relative">
              <textarea
                rows={3}
                placeholder={
                  "follow-up to Patrick about the quote and our Thursday call — confirm the start date"
                }
                className={`${inputClass} resize-none pr-12`}
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                disabled={isLoading}
              />
              {voiceSupported && (
                <button
                  type="button"
                  onClick={toggleListening}
                  disabled={isLoading}
                  aria-label={listening ? "Stop dictation" : "Dictate your email ask"}
                  className={`absolute top-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
                    listening
                      ? "border-[#22d3ee] bg-[#22d3ee]/15 text-[#22d3ee] animate-pulse"
                      : "border-slate-700 text-slate-500 hover:text-[#22d3ee] hover:border-[#22d3ee]/50"
                  }`}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Z"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    />
                    <path
                      d="M5 11a7 7 0 0 0 14 0M12 18v3"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              One line is enough — who it&apos;s to and what it&apos;s about. Your Pocket Agent fills
              in the rest from your brain.
              {listening && <span className="text-[#22d3ee] ml-1">Listening…</span>}
            </p>
          </div>
        ) : (
          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Who it&apos;s to
                </label>
                <input
                  type="text"
                  placeholder="Patrick Johnson"
                  className={inputClass}
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Relationship <span className="text-slate-600 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Current client, roofing project"
                  className={inputClass}
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Purpose of this email
              </label>
              <textarea
                rows={2}
                placeholder="Follow up after our discovery call. Send them the quote and confirm next steps."
                className={`${inputClass} resize-none`}
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Key points to cover{" "}
                <span className="text-slate-600 font-normal">(optional — bullets or phrases)</span>
              </label>
              <textarea
                rows={3}
                placeholder="Quote attached&#10;Start date: within 2 weeks&#10;Need them to confirm the shingle color from the samples&#10;Call to review together Thursday"
                className={`${inputClass} resize-none`}
                value={keyPoints}
                onChange={(e) => setKeyPoints(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Tone note{" "}
                <span className="text-slate-600 font-normal">
                  (optional — e.g. urgent, casual, formal)
                </span>
              </label>
              <input
                type="text"
                placeholder="Keep it casual — we've been texting back and forth all week"
                className={inputClass}
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>
        )}

        <button
          onClick={() => void handleGenerate()}
          disabled={!canSubmit || isLoading}
          className="w-full rounded-xl bg-[#22d3ee] px-5 py-3 text-sm font-semibold text-[#031820] hover:bg-[#06b6d4] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? "Reading brain + drafting…" : "Draft email"}
        </button>

        {error && error !== "no_api_key" && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-400 mt-6">
            {error}
          </div>
        )}

        {error === "no_api_key" && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-400 mt-6">
            Add your Anthropic API key in{" "}
            <Link href="/app/settings" className="underline">
              Settings
            </Link>{" "}
            to draft emails.
          </div>
        )}

        {draft && (
          <div className="space-y-4 mt-6">
            <div className="rounded-xl border border-slate-700 bg-slate-900 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800">
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                  Draft
                  {!hasBrain && <span className="ml-2 text-amber-500/70">· no brain connected</span>}
                </span>
                <button
                  onClick={() => void handleCopy()}
                  className="text-xs text-slate-500 hover:text-[#22d3ee] transition-colors font-mono"
                >
                  {copied ? "Copied ✓" : "Copy"}
                </button>
              </div>
              <textarea
                rows={14}
                className="w-full bg-transparent px-5 py-4 text-sm text-slate-200 leading-relaxed focus:outline-none resize-y font-mono"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
            </div>

            {citations.length > 0 && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-5 py-4">
                <div className="text-[10px] font-mono text-slate-600 uppercase tracking-wider mb-2">
                  Sources from brain
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {citations.map((c, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-800 text-[11px] font-mono text-[#22d3ee]/60"
                    >
                      {c.file}
                      {c.line ? `:${c.line}` : ""}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Stage to Inbox — the draft waits for your approval before it sends */}
            <div className="rounded-xl border border-[#22d3ee]/20 bg-[#22d3ee]/[0.04] px-5 py-4">
              {staged ? (
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-[#22d3ee]">Staged in your Inbox ✓</p>
                  <p className="text-sm text-slate-400">
                    Approve it from the{" "}
                    <Link href="/app/apps/inbox" className="underline hover:text-[#22d3ee]">
                      Inbox
                    </Link>{" "}
                    to send — nothing goes out until you say so.
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-xs font-medium text-slate-300 mb-3">
                    Send it to your Inbox to approve before it goes out.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                    <input
                      type="text"
                      placeholder="To (email address)"
                      className={inputClass}
                      value={stageTo}
                      onChange={(e) => setStageTo(e.target.value)}
                      disabled={staging}
                    />
                    <input
                      type="text"
                      placeholder="Subject (optional)"
                      className={inputClass}
                      value={stageSubject}
                      onChange={(e) => setStageSubject(e.target.value)}
                      disabled={staging}
                    />
                  </div>
                  {stageError && (
                    <p className="text-xs text-red-400 mb-2 font-mono">{stageError}</p>
                  )}
                  <button
                    onClick={() => void handleStage()}
                    disabled={staging || !draft.trim()}
                    className="w-full min-h-[44px] rounded-lg bg-[#22d3ee] px-5 py-3 text-sm font-semibold text-[#031820] hover:bg-[#06b6d4] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {staging ? "Staging…" : "Send to Inbox for approval"}
                  </button>
                </>
              )}
            </div>

            <p className="text-xs text-slate-700 leading-relaxed">
              Edit freely — it&apos;s a starting point. The voice gets sharper as you feed your brain
              more context: communication patterns, relationship notes, past email threads that
              landed well.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
