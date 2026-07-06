"use client";

// The workshop order form (PA-POS-38 §24.3): email + name + the +$27 Fast-Start bump checkbox.
// Submits to /api/workshop/registrations, which creates the registration and returns the
// Stripe-hosted checkout URL. The honest renewal line sits under the button — always visible.

import { useState } from "react";
import { WORKSHOP_COPY } from "@/lib/workshop/copy";

export function WorkshopCheckoutForm({ slotIso, timeZone, slotDisplay }: {
  slotIso: string;
  timeZone: string;
  slotDisplay: string;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [bump, setBump] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/workshop/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, slot_at: slotIso, timezone: timeZone, bump }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        checkout_url?: string;
        error?: string;
      };
      if (!res.ok || !data.checkout_url) {
        setError(data.error ?? "Something broke on our side. Try the button again.");
        setSubmitting(false);
        return;
      }
      window.location.href = data.checkout_url;
    } catch {
      setError("Something broke on our side. Try the button again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-5">
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm text-slate-300">
        Your session: <span className="font-semibold text-slate-100">{slotDisplay}</span>
      </div>
      <div>
        <label htmlFor="ws-email" className="block text-sm font-semibold text-slate-200">
          Email
        </label>
        <input
          id="ws-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-100 outline-none focus:border-accent/60"
          placeholder="you@yourbusiness.com"
        />
      </div>
      <div>
        <label htmlFor="ws-name" className="block text-sm font-semibold text-slate-200">
          First name
        </label>
        <input
          id="ws-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-100 outline-none focus:border-accent/60"
          placeholder="Optional — for the emails"
        />
      </div>
      <label className="flex cursor-pointer gap-3 rounded-2xl border border-accent/30 bg-accent/[0.04] p-4">
        <input
          type="checkbox"
          checked={bump}
          onChange={(e) => setBump(e.target.checked)}
          className="mt-1 h-4 w-4 accent-cyan-400"
        />
        <span>
          <span className="block text-sm font-semibold text-slate-100">
            {WORKSHOP_COPY.checkout.bumpLabel}
          </span>
          <span className="mt-1 block text-sm leading-relaxed text-slate-300">
            {WORKSHOP_COPY.checkout.bumpDetail}
          </span>
        </span>
      </label>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-full bg-accent px-7 py-3 text-sm font-semibold text-accent-foreground transition hover:scale-[1.01] disabled:opacity-60"
      >
        {submitting ? "Opening secure checkout…" : WORKSHOP_COPY.checkout.payButton}
      </button>
      <p className="text-center text-xs leading-relaxed text-slate-400">
        {WORKSHOP_COPY.checkout.underButton}
      </p>
    </form>
  );
}
