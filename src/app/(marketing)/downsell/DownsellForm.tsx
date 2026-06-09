"use client";

import { useState, type FormEvent } from "react";

export default function DownsellForm({ defaultEmail = "" }: { defaultEmail?: string }) {
  const [email, setEmail] = useState(defaultEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/pocket-agent/addon-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "pilot", email }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Something went wrong. Try again.");
        return;
      }
      const data = (await res.json()) as { checkout_url?: string };
      if (!data.checkout_url) {
        setError("Something went wrong. Try again.");
        return;
      }
      window.location.href = data.checkout_url;
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="email"
          className="mb-1.5 block text-sm font-medium text-slate-300"
        >
          Email address
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@yourbusiness.com"
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-slate-100 placeholder-slate-500 outline-none transition focus:border-accent/60 focus:bg-white/[0.06] focus:ring-1 focus:ring-accent/30"
        />
      </div>
      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/[0.06] px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="inline-flex w-full items-center justify-center rounded-full bg-accent px-8 py-4 text-base font-semibold text-accent-foreground shadow-[0_0_40px_-10px_rgba(34,211,238,0.7)] transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 sm:text-lg"
      >
        {busy ? "Loading…" : "Start the $97 Pilot"}
      </button>
    </form>
  );
}
