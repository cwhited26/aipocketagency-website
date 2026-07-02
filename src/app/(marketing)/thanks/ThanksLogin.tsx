"use client";

import { useState, type FormEvent } from "react";

// The pay-first login panel at the top of /thanks. The buyer paid without an account (or without a
// browser session), so the webhook already emailed them a login link and created their account. This
// panel tells them to check their inbox and lets them resend — pre-filled with the checkout email when
// /thanks could read it back from Stripe, or with a plain input when it couldn't.
export default function ThanksLogin({ email = "" }: { email?: string }) {
  const [value, setValue] = useState(email);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function resend(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/thanks/login-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Could not send the link. Try again.");
        return;
      }
      setSent(true);
    } catch {
      setError("Could not send the link. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-10 max-w-md rounded-2xl border border-cyan-300/30 bg-cyan-300/[0.05] p-6 text-left">
      <h2 className="text-lg font-semibold text-slate-100">Log in to your workspace</h2>
      {email ? (
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          We sent a login link to{" "}
          <span className="font-semibold text-slate-100">{email}</span>. Click it to
          open your workspace. Didn’t get it? Resend it below.
        </p>
      ) : (
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          We sent a login link to the email you paid with. Click it to open your
          workspace. Didn’t get it? Enter your email below and we’ll send another.
        </p>
      )}

      {sent ? (
        <p className="mt-4 rounded-xl border border-cyan-300/30 bg-cyan-300/[0.06] px-4 py-3 text-sm text-cyan-200">
          Sent. Check {value.trim()} for your login link.
        </p>
      ) : (
        <form onSubmit={resend} className="mt-4 space-y-3">
          {!email ? (
            <input
              type="email"
              required
              autoComplete="email"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="you@yourbusiness.com"
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-slate-100 placeholder-slate-500 outline-none transition focus:border-accent/60 focus:bg-white/[0.06] focus:ring-1 focus:ring-accent/30"
            />
          ) : null}
          {error ? (
            <p className="rounded-xl border border-red-500/30 bg-red-500/[0.06] px-4 py-3 text-sm text-red-300">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy || (!email && !value.trim())}
            className="inline-flex w-full items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
          >
            {busy
              ? "Sending…"
              : email
                ? "Log in to your workspace →"
                : "Send my login link →"}
          </button>
        </form>
      )}
    </div>
  );
}
