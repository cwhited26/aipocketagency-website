"use client";

import { useEffect } from "react";
import Link from "next/link";
import { UPGRADE_PROMPTS, type UpgradeTransition } from "@/lib/copy/in-app";
import { trackEvent } from "@/lib/analytics/events";

type UpgradePromptProps = {
  transition: UpgradeTransition;
  /** Where the upgrade CTA points. Defaults to the public pricing page. */
  href?: string;
  /** Where the secondary CTA points, when the copy defines one. */
  secondaryHref?: string;
  className?: string;
};

/**
 * In-app upgrade prompt (GTM Phase 4, Part 7T). Matches the existing inline upgrade-nudge pattern
 * (a card, not a hard modal). Fires `upgrade_prompt_shown` when it renders and
 * `upgrade_prompt_clicked` on the CTA — the two monetization events from Part 7Z.
 */
export function UpgradePrompt({
  transition,
  href = "/pricing",
  secondaryHref,
  className = "",
}: UpgradePromptProps) {
  const copy = UPGRADE_PROMPTS[transition];

  useEffect(() => {
    trackEvent("upgrade_prompt_shown", { transition });
  }, [transition]);

  return (
    <div
      className={`rounded-xl border border-[#22d3ee]/30 bg-slate-900/60 p-5${
        className ? ` ${className}` : ""
      }`}
    >
      <h3 className="text-base font-semibold text-slate-100">{copy.headline}</h3>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-slate-400">
        {copy.body.split("\n\n").map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          href={href}
          onClick={() => trackEvent("upgrade_prompt_clicked", { transition })}
          className="rounded-lg bg-[#22d3ee] px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-[#67e8f9]"
        >
          {copy.cta}
        </Link>
        {copy.secondaryCta ? (
          <Link
            href={secondaryHref ?? "/pricing"}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-slate-400 hover:text-slate-100"
          >
            {copy.secondaryCta}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
