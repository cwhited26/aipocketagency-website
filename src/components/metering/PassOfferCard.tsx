"use client";

// Project Pass rental offer (PA-POS-31) — shown on a gated App surface to an owner whose tier
// doesn't include it, ALONGSIDE the existing upgrade path (the pass never replaces it). A pass
// is a paid rental for a bounded project — not a trial, not credits.

import { useState } from "react";

export type PassOfferView = {
  appSlug: string;
  label: string;
  priceCents: number;
  windowLabel: string;
};

export function PassOfferCard({ offer }: { offer: PassOfferView }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const price = `$${(offer.priceCents / 100).toFixed(0)}`;

  async function buyPass() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/app/metering/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "project_pass", app_slug: offer.appSlug }),
      });
      const data = (await res.json()) as { checkout_url?: string; error?: string };
      if (!res.ok || !data.checkout_url) {
        setError(data.error ?? "Could not start checkout. Please try again.");
        setPending(false);
        return;
      }
      window.location.assign(data.checkout_url);
    } catch {
      setError("Could not start checkout. Please try again.");
      setPending(false);
    }
  }

  return (
    <div className="rounded-xl border border-[#22d3ee]/30 bg-[#22d3ee]/5 px-4 py-4">
      <p className="font-mono text-[11px] uppercase tracking-wider text-[#22d3ee]/80">
        Project Pass
      </p>
      <p className="mt-1 text-sm text-slate-200">
        Not in your tier — get a Project Pass ({price} / {offer.windowLabel}).
      </p>
      <p className="mt-1 text-xs text-slate-400">
        Rent {offer.label} for your project. {price} for {offer.windowLabel}. One-time — it ends
        when the window ends, or upgrade when the rentals start stacking up.
      </p>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => void buyPass()}
          className="rounded-lg bg-[#22d3ee] px-3 py-1.5 font-mono text-xs font-semibold text-slate-950 hover:bg-[#67e8f9] transition-colors disabled:opacity-50"
        >
          {pending ? "Starting checkout" : `Get the Pass — ${price}`}
        </button>
        <span className="text-[11px] text-slate-500">
          The tool you need, for the project you have.
        </span>
      </div>
      {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
    </div>
  );
}
