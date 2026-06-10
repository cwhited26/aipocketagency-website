import Link from "next/link";
import { SUCCESS, type SuccessKey } from "@/lib/copy/in-app";

type SuccessBannerProps = {
  step: SuccessKey;
  ctaHref?: string;
  secondaryHref?: string;
  className?: string;
};

/**
 * Activation success banner (GTM Phase 4, Part 7X). Fires on Business Brain create / Persona create /
 * workflow install / Mission Control review / 3-3-3 complete. Each one points at the next step.
 * Presentational — safe to render from a Server Component.
 */
export function SuccessBanner({ step, ctaHref, secondaryHref, className = "" }: SuccessBannerProps) {
  const copy = SUCCESS[step];
  return (
    <div
      className={`rounded-xl border border-[#22d3ee]/30 bg-[#22d3ee]/[0.06] p-4${
        className ? ` ${className}` : ""
      }`}
    >
      <h3 className="text-sm font-semibold text-slate-100">{copy.headline}</h3>
      {copy.subheadline ? (
        <p className="mt-0.5 text-sm font-medium text-[#22d3ee]/90">{copy.subheadline}</p>
      ) : null}
      <div className="mt-1 space-y-2 text-sm leading-relaxed text-slate-400">
        {(copy.body ?? "").split("\n\n").map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-3">
        {copy.cta && ctaHref ? (
          <Link
            href={ctaHref}
            className="rounded-lg bg-[#22d3ee] px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-[#67e8f9]"
          >
            {copy.cta}
          </Link>
        ) : null}
        {copy.secondaryCta && secondaryHref ? (
          <Link
            href={secondaryHref}
            className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-400 hover:text-slate-100"
          >
            {copy.secondaryCta}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
