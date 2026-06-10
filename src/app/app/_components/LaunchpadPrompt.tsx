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
 * joined success message. The join link resolves to the Skool surface the email system points at;
 * Chase wires the real Skool community URL behind /app/skool. Presentational.
 */
export function LaunchpadPrompt({ joined, href = "/app/skool", className = "" }: LaunchpadPromptProps) {
  const copy = joined ? LAUNCHPAD.joined : LAUNCHPAD.notJoined;
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
