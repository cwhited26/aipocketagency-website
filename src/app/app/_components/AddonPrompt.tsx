"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ADDON_PROMPTS } from "@/lib/copy/in-app";
import { trackEvent } from "@/lib/analytics/events";

type AddonKind = "pa_sync" | "pa_publish";

const COPY = {
  pa_sync: ADDON_PROMPTS.paSync,
  pa_publish: ADDON_PROMPTS.paPublish,
} as const;

const SHOWN_EVENT = {
  pa_sync: "pa_sync_prompt_shown",
  pa_publish: "pa_publish_prompt_shown",
} as const;

type AddonPromptProps = {
  kind: AddonKind;
  /** Where the add CTA points (e.g. an add-on checkout route). */
  href?: string;
  className?: string;
};

/**
 * Contextual add-on prompt (GTM Phase 4, Part 7U) for PA Sync and PA Publish. Fires the matching
 * `*_prompt_shown` monetization event (Part 7Z) on mount.
 */
export function AddonPrompt({ kind, href = "/pricing", className = "" }: AddonPromptProps) {
  const copy = COPY[kind];

  useEffect(() => {
    trackEvent(SHOWN_EVENT[kind]);
  }, [kind]);

  return (
    <div
      className={`rounded-xl border border-slate-700/60 bg-slate-900/60 p-4${
        className ? ` ${className}` : ""
      }`}
    >
      <h3 className="text-sm font-semibold text-slate-100">{copy.headline}</h3>
      <div className="mt-1 space-y-2 text-sm leading-relaxed text-slate-400">
        {(copy.body ?? "").split("\n\n").map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      {copy.cta ? (
        <Link
          href={href}
          className="mt-3 inline-block rounded-lg bg-[#22d3ee] px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-[#67e8f9]"
        >
          {copy.cta}
        </Link>
      ) : null}
    </div>
  );
}
