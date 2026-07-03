"use client";

// The Studio+/Enterprise credits chip (PA-POS-30): "Credits: X / Y this cycle" + the Top Up
// panel. This component NEVER decides who sees it — buildCreditsChipModel returns null for
// every tier below studio_plus, and the server wrapper renders nothing on null. Subscription-
// first framing: the allowance is included in the plan; the Top Up is the backstop, offered
// before the next action would exceed it, never mid-session.

import { useState } from "react";
import type { CreditsChipModel } from "@/lib/metering/credits";

function formatCredits(n: number): string {
  return n.toLocaleString("en-US");
}

export function CreditsChip({ model }: { model: CreditsChipModel }) {
  const [open, setOpen] = useState(false);
  const [pendingBundle, setPendingBundle] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function buyBundle(bundleId: string) {
    setPendingBundle(bundleId);
    setError(null);
    try {
      const res = await fetch("/api/app/metering/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "top_up", bundle_id: bundleId }),
      });
      const data = (await res.json()) as { checkout_url?: string; error?: string };
      if (!res.ok || !data.checkout_url) {
        setError(data.error ?? "Could not start checkout. Please try again.");
        setPendingBundle(null);
        return;
      }
      window.location.assign(data.checkout_url);
    } catch {
      setError("Could not start checkout. Please try again.");
      setPendingBundle(null);
    }
  }

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
          Credits: <span className="text-slate-100">{formatCredits(model.remainingCredits)}</span>
          {" / "}
          {formatCredits(model.totalCredits)} this cycle
        </span>
        {model.offerTopUp ? (
          <span className="font-mono text-[11px] text-amber-300/90">
            Running low — top up before your next run.
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="ml-auto font-mono text-[11px] text-[#22d3ee] hover:text-[#67e8f9] transition-colors"
        >
          {open ? "Close" : "Top Up →"}
        </button>
      </div>

      {open ? (
        <div className="mt-3 border-t border-slate-800 pt-3">
          <p className="text-xs text-slate-400">
            Your plan includes {formatCredits(model.totalCredits)} credits a month, sized for
            typical use of Browser Agent, Idea Engine, and Decision Roundtable. If you run out,
            we&rsquo;ll offer you a Top Up bundle. No mid-session surprises.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {model.bundles.map((b) => (
              <button
                key={b.id}
                type="button"
                disabled={pendingBundle !== null}
                onClick={() => void buyBundle(b.id)}
                className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-left hover:border-[#22d3ee]/50 transition-colors disabled:opacity-50"
              >
                <span className="block font-mono text-xs text-slate-100">
                  +{formatCredits(b.credits)} credits
                </span>
                <span className="block font-mono text-[11px] text-slate-400">
                  ${(b.amountCents / 100).toFixed(0)}
                  {pendingBundle === b.id ? " · starting checkout" : ""}
                </span>
              </button>
            ))}
          </div>
          {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
