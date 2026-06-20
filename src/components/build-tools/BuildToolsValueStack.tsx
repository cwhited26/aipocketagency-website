// BuildToolsValueStack — the value-first pre-flight panel (PA-BUILDONBOARD-1).
//
// Pure presentational, no hooks — safe to render from a Server Component (the Idea Engine banner) or
// inside a client modal (the Template Gallery Build intercept). It states what the owner walks away
// owning, then offers the one or two connect buttons that are still missing. Connect links are plain
// anchors: GitHub's button hits an OAuth route handler that redirects, so it needs a full navigation.

import type { PreflightConnector } from "@/lib/build-tools/onboarding";

export function BuildToolsValueStack({
  eyebrow,
  title,
  valueStack,
  connectors,
  footer,
}: {
  eyebrow?: string;
  title: string;
  valueStack: readonly string[];
  connectors: PreflightConnector[];
  footer: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        {eyebrow ? (
          <p className="text-[11px] text-[#22d3ee]/60 font-mono tracking-[0.18em] uppercase mb-1">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="text-lg font-bold text-slate-100">{title}</h2>
      </div>

      <ol className="flex flex-col gap-2.5">
        {valueStack.map((line, i) => (
          <li key={line} className="flex items-start gap-3">
            <span
              aria-hidden
              className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#22d3ee]/15 text-[11px] font-semibold text-[#22d3ee]"
            >
              {i + 1}
            </span>
            <span className="text-sm text-slate-300 leading-relaxed">{line}</span>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap gap-3">
        {connectors.map((c) => (
          <a
            key={c.id}
            href={c.href}
            className="inline-flex items-center rounded-lg bg-[#22d3ee] px-4 py-2.5 text-sm font-semibold text-[#06121a] hover:bg-[#22d3ee]/90 transition-colors"
          >
            {c.buttonLabel}
          </a>
        ))}
      </div>

      <p className="text-[13px] text-slate-500 leading-relaxed">{footer}</p>
    </div>
  );
}
