"use client";

import { trackEvent } from "@/lib/analytics/events";

export interface QuizOptionLink {
  label: string;
  href: string;
  /** Set on the final license question so the click also records the matched tier. */
  tier?: string;
}

// Renders the answer options for one quiz step as navigating anchors. The click fires
// funnel_step_completed (and funnel_tier_selected on Step 5) before the browser follows the
// href — a full navigation, so the back button and URL-only state work without client state.
export default function QuizOptions({
  slug,
  stepIndex,
  options,
}: {
  slug: string;
  stepIndex: number;
  options: QuizOptionLink[];
}) {
  function handleSelect(optionIndex: number, tier?: string) {
    trackEvent("funnel_step_completed", {
      step: slug,
      step_index: stepIndex,
      option_index: optionIndex,
    });
    if (tier) {
      trackEvent("funnel_tier_selected", { tier, step: slug });
    }
  }

  return (
    <div className="mt-8 grid w-full gap-3">
      {options.map((opt, i) => (
        <a
          key={opt.label}
          href={opt.href}
          onClick={() => handleSelect(i, opt.tier)}
          className="group flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 text-left text-base text-slate-200 transition hover:border-cyan-300/40 hover:bg-cyan-300/[0.06]"
        >
          <span>{opt.label}</span>
          <span
            aria-hidden
            className="text-cyan-300 opacity-0 transition group-hover:opacity-100"
          >
            →
          </span>
        </a>
      ))}
    </div>
  );
}
