import Link from "next/link";
import { LAUNCHPAD } from "@/lib/copy/in-app";

type LaunchpadPromptProps = {
  joined: boolean;
  /** Where the join CTA points. Defaults to the in-app Skool surface (/app/skool). */
  href?: string;
  className?: string;
};

/**
 * Pocket Agent Launchpad in-app prompt (GTM Phase 4, Part 7S). Shows the not-joined pitch or the
 * joined success message. The join CTA points at the real Skool community URL (SKOOL_URL) — an
 * external link, so it renders as a plain anchor opening in a new tab; an internal href still
 * routes through next/link. Presentational.
 */
export function LaunchpadPrompt({ joined, href = "/app/skool", className = "" }: LaunchpadPromptProps) {
  const copy = joined ? LAUNCHPAD.joined : LAUNCHPAD.notJoined;
  const isExternal = href.startsWith("http://") || href.startsWith("https://");
  const ctaClassName =
    "mt-3 inline-block rounded-lg bg-[#22d3ee] px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-[#67e8f9]";
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
        isExternal ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className={ctaClassName}>
            {copy.cta}
          </a>
        ) : (
          <Link href={href} className={ctaClassName}>
            {copy.cta}
          </Link>
        )
      ) : null}
    </div>
  );
}
