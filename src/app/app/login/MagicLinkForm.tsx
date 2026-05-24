"use client";

import { useState } from "react";

export default function MagicLinkForm() {
  const [email, setEmail] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || isPending) return;
    setError(null);
    setIsPending(true);
    try {
      const res = await fetch("/api/app/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Something went wrong. Try again.");
        return;
      }
      setSent(true);
    } finally {
      setIsPending(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-4 text-sm text-center space-y-1">
        <p className="text-cyan-300 font-medium">Check your email</p>
        <p className="text-slate-400">
          We sent a sign-in link to <span className="text-slate-200">{email}</span>.
          Click it to access Pocket Agent.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={isPending}
        required
        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-[#22d3ee] focus:outline-none disabled:opacity-50"
      />
      {error && (
        <p className="text-xs text-red-400 text-center">{error}</p>
      )}
      <button
        type="submit"
        disabled={!email.trim() || isPending}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-medium text-slate-100 hover:bg-slate-700 hover:border-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? "Sending…" : "Continue with email →"}
      </button>
    </form>
  );
}
