"use client";

// The one-yes/one-no OTO surface (PA-POS-38 §24.3). One button charges the saved payment method
// via POST /api/workshop/oto/[n] — no card re-entry; the other advances. No countdown clocks, no
// fake scarcity — the offer is one-time because the page never comes back, and that's stated.

import { useState } from "react";
import { MONO_FONT } from "@/components/marketing/cta";

export function OtoDecision({ oto, sessionId, copy, nextOnYes, nextOnNo }: {
  oto: 1 | 2;
  sessionId: string;
  copy: {
    pill: string;
    heading: string;
    body: string;
    price: string;
    yes: string;
    yesDetail: string;
    no: string;
  };
  nextOnYes: string;
  nextOnNo: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(accept: boolean) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/workshop/oto/${oto}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, accept }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (accept && !res.ok) {
        setError(data.error ?? "The charge didn't go through. Your workshop seat is unaffected.");
        setBusy(false);
        return;
      }
      window.location.href = accept ? nextOnYes : nextOnNo;
    } catch {
      setError("Something broke on our side. Try again, or take the no-thanks link — your seat is safe.");
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#05070a] px-6 py-16 text-slate-100">
      <div className="w-full max-w-2xl text-center">
        <div className="mb-4 inline-block text-xs text-cyan-300/70" style={{ fontFamily: MONO_FONT }}>
          {copy.pill}
        </div>
        <h1 className="text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
          {copy.heading}
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-slate-300">{copy.body}</p>
        <p className="mt-6 text-lg font-bold">{copy.price}</p>
        {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
        <div className="mt-8 space-y-4">
          <button
            type="button"
            disabled={busy}
            onClick={() => void decide(true)}
            className="w-full rounded-full bg-accent px-7 py-4 text-base font-semibold text-accent-foreground transition hover:scale-[1.01] disabled:opacity-60"
          >
            {busy ? "Running the charge…" : copy.yes}
          </button>
          <p className="text-xs text-slate-400">{copy.yesDetail}</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void decide(false)}
            className="text-sm text-slate-400 underline-offset-4 transition hover:text-slate-200 hover:underline"
          >
            {copy.no}
          </button>
        </div>
        <p className="mt-10 text-xs text-slate-500">
          This page shows once. Your workshop seat and your 30 days of Business Agent are already
          booked either way.
        </p>
      </div>
    </main>
  );
}
