"use client";

import { useState } from "react";
import Link from "next/link";
import type { NudgeKey } from "@/lib/activation/state";
import { NUDGES } from "@/lib/copy/in-app";

// Nudge → where its CTA points (Part 7W). The destination is the very next activation action.
const NUDGE_HREFS: Record<NudgeKey, string> = {
  no_business_brain: "/app/capture",
  business_brain_no_persona: "/app/personas",
  persona_no_workflow: "/app/apps",
  workflow_no_mission_control: "/app/mission-control",
  no_launchpad_join: "/app/skool",
  activation_complete: "/app/apps",
};

/**
 * The dashboard activation nudge banner (GTM Phase 4, Part 7W). One banner pointing at the owner's
 * next activation step, chosen by selectNudge(). Dismissable for the session. Client component so it
 * can be dismissed without a round-trip.
 */
export function ActivationNudge({ nudge }: { nudge: NudgeKey }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const copy = NUDGES[nudge];
  const paragraphs = copy.body ? copy.body.split("\n\n") : [];

  return (
    <div className="relative rounded-xl border border-[#22d3ee]/30 bg-[#22d3ee]/[0.06] p-4">
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="absolute right-3 top-3 text-slate-500 transition hover:text-slate-300"
      >
        ×
      </button>
      <h3 className="pr-6 text-sm font-semibold text-slate-100">{copy.headline}</h3>
      {paragraphs.map((p, i) => (
        <p key={i} className="mt-1 text-sm leading-relaxed text-slate-400">
          {p}
        </p>
      ))}
      {copy.cta ? (
        <Link
          href={NUDGE_HREFS[nudge]}
          className="mt-3 inline-block rounded-lg bg-[#22d3ee] px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-[#67e8f9]"
        >
          {copy.cta}
        </Link>
      ) : null}
    </div>
  );
}
