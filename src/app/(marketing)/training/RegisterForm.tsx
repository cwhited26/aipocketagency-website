"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

// The "Save My Seat" form (Part 3A primary CTA). Posts email + name to /api/webinar/register, which
// persists the registration and enqueues the 20-email webinar sequence, then routes to the thank-you
// page. A real form — not a placeholder.
export default function RegisterForm({ ctaLabel = "Save My Seat" }: { ctaLabel?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/webinar/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, firstName: name }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Something went wrong. Try again.");
        return;
      }
      const data = (await res.json()) as { redirect?: string };
      router.push(data.redirect ?? "/training-confirmed");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto mt-8 w-full max-w-md space-y-4 text-left">
      <div>
        <label htmlFor="webinar-email" className="mb-1.5 block text-sm font-medium text-slate-300">
          Email address
        </label>
        <input
          id="webinar-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@yourbusiness.com"
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-slate-100 placeholder-slate-500 outline-none transition focus:border-accent/60 focus:bg-white/[0.06] focus:ring-1 focus:ring-accent/30"
        />
      </div>
      <div>
        <label htmlFor="webinar-name" className="mb-1.5 block text-sm font-medium text-slate-300">
          First name <span className="text-slate-500">(optional)</span>
        </label>
        <input
          id="webinar-name"
          type="text"
          autoComplete="given-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Dana"
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
        className="inline-flex w-full items-center justify-center gap-3 rounded-full bg-accent px-8 py-4 text-base font-semibold text-accent-foreground shadow-[0_0_40px_-10px_rgba(34,211,238,0.7)] transition hover:scale-[1.02] hover:shadow-[0_0_60px_-8px_rgba(34,211,238,0.85)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 sm:text-lg"
      >
        {busy ? "Saving your seat…" : ctaLabel}
      </button>
      <p className="text-center text-xs text-slate-500">
        Free training for owner-led businesses. No APIs. No automation maps. No technical setup
        required.
      </p>
    </form>
  );
}
