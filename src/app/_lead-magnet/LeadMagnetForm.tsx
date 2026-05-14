"use client";

import { useState } from "react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MONO_FONT =
  "var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace";

type Phase = "button" | "form" | "done";
type GuideResponse = { ok: true; lead_id: string; guide_url: string } | { error: string };

export default function LeadMagnetForm() {
  const [phase, setPhase] = useState<Phase>("button");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guideUrl, setGuideUrl] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    const trimmedName = name.trim();

    if (!EMAIL_RE.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/apa/guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, name: trimmedName || undefined }),
      });

      const data = (await res.json().catch(() => ({}))) as GuideResponse;

      if (!res.ok) {
        setError(
          "error" in data ? data.error : "Something went wrong. Please try again.",
        );
        setBusy(false);
        return;
      }

      if ("guide_url" in data) setGuideUrl(data.guide_url);
      setPhase("done");
    } catch {
      setError("Network error. Please try again.");
      setBusy(false);
    }
  }

  if (phase === "done") {
    return (
      <div className="mt-5 space-y-3 rounded-xl border border-accent/30 bg-accent/[0.06] px-5 py-4 text-sm leading-relaxed text-slate-200">
        <p>Got it — the guide is in your inbox.</p>
        {guideUrl ? (
          <a
            href={guideUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-emerald-400/50 bg-emerald-400/[0.08] px-4 py-2 text-xs font-semibold text-emerald-300 transition hover:border-emerald-400 hover:bg-emerald-400/[0.15]"
          >
            <svg aria-hidden viewBox="0 0 20 20" className="h-3.5 w-3.5 shrink-0" fill="currentColor">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            Download your guide (PDF)
          </a>
        ) : null}
      </div>
    );
  }

  if (phase === "button") {
    return (
      <div className="mt-5">
        <button
          type="button"
          onClick={() => setPhase("form")}
          className="inline-flex items-center gap-2 rounded-full border border-emerald-400/50 bg-emerald-400/[0.06] px-5 py-2.5 text-sm font-semibold text-emerald-300 transition hover:border-emerald-400 hover:bg-emerald-400/[0.12]"
        >
          Get the guide (free)
          <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
            <path d="M7.05 4.05a1 1 0 011.414 0l5.243 5.243a1 1 0 010 1.414l-5.243 5.243a1 1 0 01-1.414-1.414L11.586 11H3a1 1 0 110-2h8.586L7.05 5.464a1 1 0 010-1.414z" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-5 space-y-3" noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="guide-email" className="text-xs font-medium text-slate-400">
          Email
        </label>
        <input
          id="guide-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          disabled={busy}
          placeholder="you@example.com"
          className="rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/30 disabled:opacity-60"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="guide-name" className="text-xs font-medium text-slate-400">
          Name{" "}
          <span style={{ fontFamily: MONO_FONT }} className="text-slate-600">
            (optional)
          </span>
        </label>
        <input
          id="guide-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          disabled={busy}
          placeholder="Chase"
          className="rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/30 disabled:opacity-60"
        />
      </div>

      {error ? (
        <div
          className="rounded-xl border border-red-400/30 bg-red-400/[0.08] px-4 py-3 text-sm text-red-200"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-emerald-400/50 bg-emerald-400/[0.08] px-5 py-2.5 text-sm font-semibold text-emerald-300 transition hover:border-emerald-400 hover:bg-emerald-400/[0.15] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Sending…" : "Send me the guide →"}
      </button>
    </form>
  );
}
