import Link from "next/link";
import type { ReactNode } from "react";
import type { ScreenCopy } from "@/lib/copy/in-app";

type AppEmptyStateProps = {
  copy: ScreenCopy;
  /** Where the primary CTA links. Omit to render the CTA label as static text. */
  ctaHref?: string;
  /** Where the secondary CTA links (only rendered if copy.secondaryCta is set). */
  secondaryHref?: string;
  /** Optional icon/illustration slot above the headline. */
  icon?: ReactNode;
  className?: string;
};

/**
 * The house empty-state block (GTM Phase 4, Part 7D–7R). Consumes a ScreenCopy from the in-app copy
 * bank so every surface reads the same Hormozi-voice language. Body text is split on blank lines into
 * paragraphs. Pure presentational — safe to render from a Server Component.
 */
export function AppEmptyState({
  copy,
  ctaHref,
  secondaryHref,
  icon,
  className = "",
}: AppEmptyStateProps) {
  const paragraphs = copy.body ? copy.body.split("\n\n") : [];
  return (
    <div
      className={`mx-auto flex max-w-xl flex-col items-center gap-4 rounded-2xl border border-slate-700/60 bg-slate-900/50 px-6 py-10 text-center${
        className ? ` ${className}` : ""
      }`}
    >
      {icon ? <div className="text-[#22d3ee]">{icon}</div> : null}
      <h2 className="text-xl font-semibold text-slate-100">{copy.headline}</h2>
      {copy.subheadline ? (
        <p className="text-sm font-medium text-[#22d3ee]/90">{copy.subheadline}</p>
      ) : null}
      {paragraphs.length > 0 ? (
        <div className="space-y-2 text-sm leading-relaxed text-slate-400">
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        {copy.cta ? (
          ctaHref ? (
            <Link
              href={ctaHref}
              className="rounded-lg bg-[#22d3ee] px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-[#67e8f9]"
            >
              {copy.cta}
            </Link>
          ) : (
            <span className="rounded-lg bg-[#22d3ee] px-4 py-2 text-sm font-semibold text-slate-950">
              {copy.cta}
            </span>
          )
        ) : null}
        {copy.secondaryCta ? (
          secondaryHref ? (
            <Link
              href={secondaryHref}
              className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-slate-400 hover:text-slate-100"
            >
              {copy.secondaryCta}
            </Link>
          ) : (
            <span className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300">
              {copy.secondaryCta}
            </span>
          )
        ) : null}
      </div>
      {copy.microcopy ? <p className="text-xs text-slate-500">{copy.microcopy}</p> : null}
    </div>
  );
}
