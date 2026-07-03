"use client";

// The auto-conversion nudge (PA-POS-31 amendment, 2026-07-03). Renders after the 2nd purchase
// of the same App inside 21 days. Shows the math, respects the choice: one link to the tiers
// (click tracked so conversion is measurable), one dismiss that just closes the card. It never
// discounts, never throttles, never blocks the next rental — customer autonomy is the rule.

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { NudgeCopy } from "@/lib/metering/nudge-copy";

export function PassNudgeCard({ appSlug, copy }: { appSlug: string; copy: NudgeCopy }) {
  const [dismissed, setDismissed] = useState(false);
  const router = useRouter();

  if (dismissed) return null;

  async function seeTiers() {
    // Best-effort click event for the /admin/passes funnel; navigation never waits on failure.
    try {
      await fetch("/api/app/metering/nudge-click", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app_slug: appSlug }),
      });
    } catch {
      // accounting only — the navigation below is the point
    }
    router.push("/app/settings/tier");
  }

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 px-4 py-4">
      <p className="text-sm font-semibold text-slate-100">{copy.headline}</p>
      <p className="mt-1 text-xs text-slate-400">{copy.body}</p>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => void seeTiers()}
          className="rounded-lg border border-[#22d3ee]/50 px-3 py-1.5 font-mono text-xs text-[#22d3ee] hover:bg-[#22d3ee]/10 transition-colors"
        >
          {copy.ctaLabel}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="font-mono text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          {copy.dismissLabel}
        </button>
      </div>
    </div>
  );
}
