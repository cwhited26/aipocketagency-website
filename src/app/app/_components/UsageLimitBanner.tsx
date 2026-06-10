"use client";

import { useEffect } from "react";
import Link from "next/link";
import { USAGE_PROMPTS, type UsageLimitKind } from "@/lib/copy/in-app";
import { trackEvent } from "@/lib/analytics/events";

type UsageLimitBannerProps = {
  kind: UsageLimitKind;
  /** Where the upgrade CTA points. Defaults to the public pricing page. */
  href?: string;
  className?: string;
};

/**
 * Real-time usage-cap banner (GTM Phase 4, Part 7V). Fires when the owner hits a cap (leads /
 * Whisper hours / sub-agent runs). Mirrors the email confirmation enqueued by the existing usage-cap
 * hook — same message, different channel. Records the `usage_limit_hit` monetization event on mount.
 */
export function UsageLimitBanner({ kind, href = "/pricing", className = "" }: UsageLimitBannerProps) {
  const copy = USAGE_PROMPTS[kind];

  useEffect(() => {
    trackEvent("usage_limit_hit", { kind });
  }, [kind]);

  return (
    <div
      className={`rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-4${
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
          className="mt-3 inline-block rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-amber-300"
        >
          {copy.cta}
        </Link>
      ) : null}
    </div>
  );
}
