"use client";

import { useEffect, useState } from "react";
import {
  dismissUntilIso,
  isDismissalActive,
  UPGRADE_DISMISS_KEY,
  UPGRADE_PITCH_HREF,
} from "@/lib/pocket-capture/upgrade-pitch";

// The upgrade-to-Pocket-Agent pitch (PC-MARK-5). The server slot decides WHETHER a standalone buyer
// is eligible (30 captures OR 14 days, no active PA sub); this client card honors the 7-day "Not now"
// dismissal that can only live in the browser. Renders nothing while a dismissal is active.

export function UpgradeToPaCard({ captureCount }: { captureCount: number }) {
  // Start hidden until we've checked localStorage, so a dismissed card never flashes in.
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      setDismissed(isDismissalActive(window.localStorage.getItem(UPGRADE_DISMISS_KEY), Date.now()));
    } catch {
      setDismissed(false);
    }
  }, []);

  if (dismissed !== false) return null;

  function notNow() {
    setDismissed(true);
    try {
      window.localStorage.setItem(UPGRADE_DISMISS_KEY, dismissUntilIso(Date.now()));
    } catch {
      // If we can't persist, the card still hides for this view.
    }
  }

  return (
    <section className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.04] p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-slate-100">
        You&rsquo;ve saved {captureCount} {captureCount === 1 ? "capture" : "captures"}. Here&rsquo;s
        what comes next.
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
        Your Pocket Agent stays the same. But now it can DO things with your captures &mdash; draft
        follow-up emails in your voice, scout leads, build pages, schedule reminders, more.
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
        <a
          href={UPGRADE_PITCH_HREF}
          className="inline-flex items-center rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
        >
          Upgrade to Pocket Agent &mdash; $97/mo
        </a>
        <button
          type="button"
          onClick={notNow}
          className="text-sm font-medium text-slate-400 transition hover:text-slate-200"
        >
          Not now
        </button>
      </div>
    </section>
  );
}
