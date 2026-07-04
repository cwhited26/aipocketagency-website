import Image from "next/image";
import Link from "next/link";
import {
  INTEGRATIONS,
  LIBRARY_TIER_LABEL,
  type LibraryAgent,
} from "@/data/agents-library";
import { MONO_FONT } from "./cta";

// One card in the Agents Library grid (PA-POS-24). Pure presentational — rendered by the
// server rails on /use-cases/*, inside the client filter explorer on /agents, and on the
// authenticated mirror at /app/agents (PA-POS-37). The card body is identical everywhere;
// `cta` swaps the action for the auth state — signup link by default, Clone in the workspace.
export function AgentCard({ agent, cta }: { agent: LibraryAgent; cta?: React.ReactNode }) {
  return (
    <article
      data-agent-card={agent.slug}
      className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition hover:border-accent/30 hover:bg-white/[0.04]"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[15px] font-semibold leading-snug text-slate-100">{agent.name}</h3>
        <span
          className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-wider text-slate-400"
          style={{ fontFamily: MONO_FONT }}
        >
          {LIBRARY_TIER_LABEL[agent.tier]}
        </span>
      </div>

      <ul className="mt-4 space-y-2">
        {agent.workflow.map((step) => (
          <li key={step} className="flex gap-2.5 text-[13px] leading-snug text-slate-400">
            <svg
              viewBox="0 0 20 20"
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent/70"
              fill="currentColor"
              aria-hidden
            >
              <path d="M7.05 4.05a1 1 0 011.414 0l5.243 5.243a1 1 0 010 1.414l-5.243 5.243a1 1 0 01-1.414-1.414L11.586 11H3a1 1 0 110-2h8.586L7.05 5.464a1 1 0 010-1.414z" />
            </svg>
            <span>{step}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 rounded-xl border border-accent/15 bg-accent/[0.05] px-3.5 py-3">
        <span
          className="block text-[10px] uppercase tracking-wider text-accent/70"
          style={{ fontFamily: MONO_FONT }}
        >
          it reported back
        </span>
        <p className="mt-1.5 text-[13px] leading-snug text-slate-300">
          &ldquo;{agent.completion}&rdquo;
        </p>
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 pt-5">
        <div className="flex items-center gap-1.5" aria-label="Tools this agent works with">
          {agent.integrations.map((slug) => {
            const icon = INTEGRATIONS[slug];
            return (
              <span
                key={slug}
                title={icon.label}
                className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-white/[0.04]"
              >
                <Image src={icon.src} alt={icon.label} width={16} height={16} unoptimized />
              </span>
            );
          })}
        </div>
        {cta ?? (
          <Link
            href={`/start?tier=${agent.tier}&agent=${agent.slug}`}
            className="shrink-0 rounded-lg border border-accent/40 bg-accent/[0.06] px-3.5 py-2 text-[13px] font-semibold text-accent transition hover:border-accent hover:bg-accent/[0.12]"
          >
            Use this agent
          </Link>
        )}
      </div>
    </article>
  );
}
