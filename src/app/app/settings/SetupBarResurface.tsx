"use client";

import { useEffect, useState } from "react";

// Settings → Onboarding control for bringing back the Agent-landing setup status bar after the
// owner has dismissed it. Only shows while the bar is actually hidden — on this device (localStorage)
// or on the account row (server prop). Tapping "Show it again" clears both, so the bar returns on
// the next visit to the Agent landing.
const STORAGE_KEY = "pa_setup_bar_dismissed";

export default function SetupBarResurface({
  setupBarDismissedAt,
}: {
  setupBarDismissedAt: string | null;
}) {
  // Match SSR on first render (server prop only), then fold in localStorage after mount so a
  // device-local dismissal also surfaces this control.
  const [hidden, setHidden] = useState(setupBarDismissedAt != null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === "1") setHidden(true);
  }, []);

  if (!hidden) return null;

  async function resurface() {
    setWorking(true);
    setError(false);
    try {
      const res = await fetch("/api/app/setup-bar/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dismissed: false }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      localStorage.removeItem(STORAGE_KEY);
      setHidden(false);
    } catch {
      setError(true);
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 px-5 py-4 flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-semibold text-slate-100">Setup bar hidden</p>
        <p className="text-xs text-slate-500 mt-0.5">
          {error
            ? "Couldn't bring it back just now — try again."
            : "The setup checklist on the Agent page is turned off."}
        </p>
      </div>
      <button
        type="button"
        onClick={resurface}
        disabled={working}
        className="shrink-0 text-sm font-semibold rounded-lg bg-[#22d3ee] px-4 py-2 text-[#031820] hover:bg-[#06b6d4] disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[40px]"
      >
        {working ? "Showing…" : "Show it again"}
      </button>
    </div>
  );
}
