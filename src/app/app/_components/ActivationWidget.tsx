import Link from "next/link";
import type { ActivationState } from "@/lib/activation/state";
import { DASHBOARD, PROGRESS_COPY } from "@/lib/copy/in-app";

type ChecklistRow = {
  label: string;
  detail: string;
  done: boolean;
};

// Quick-action label → destination. Labels are verbatim from Part 7C.
const QUICK_ACTION_HREFS: Record<string, string> = {
  "Add Business Brain Asset": "/app/capture",
  "Clone Persona": "/app/personas",
  "Install Workflow": "/app/apps",
  "Open Mission Control": "/app/mission-control",
  "Join Launchpad": "/app/skool",
  "Run Lead Scout": "/app/apps/lead-scout",
  "Use Idea Engine": "/app/apps/idea-engine",
};

function pillarDetail(count: number, target: number, noun: string): string {
  return `${count} of ${target} ${noun}`;
}

/**
 * The dashboard 3-3-3 activation widget (GTM Phase 4, Part 7C). Presentational — takes the computed
 * ActivationState and renders the progress bar, the five-row checklist, the percentage-driven
 * progress copy, and the seven quick actions. Server-renderable.
 */
export function ActivationWidget({ state }: { state: ActivationState }) {
  const { input, pillars, percent, progressKey } = state;

  const rows: ChecklistRow[] = [
    {
      label: DASHBOARD.checklist.businessBrain,
      detail: pillarDetail(input.businessBrainAssets, 3, "added"),
      done: pillars.businessBrain === "complete",
    },
    {
      label: DASHBOARD.checklist.personas,
      detail: pillarDetail(input.personas, 3, "trained"),
      done: pillars.personas === "complete",
    },
    {
      label: DASHBOARD.checklist.workflows,
      detail: pillarDetail(input.workflows, 3, "installed"),
      done: pillars.workflows === "complete",
    },
    {
      label: DASHBOARD.checklist.missionControl,
      detail: input.missionControlReviewed ? "Reviewed" : "Not reviewed yet",
      done: input.missionControlReviewed,
    },
    {
      label: DASHBOARD.checklist.launchpad,
      detail: input.launchpadJoined ? "Joined" : "Not joined yet",
      done: input.launchpadJoined,
    },
  ];

  return (
    <section className="rounded-2xl border border-[#22d3ee]/20 bg-slate-900/60 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-100">{DASHBOARD.widgetTitle}</h2>
        <span className="font-mono text-sm text-[#22d3ee]">{percent}%</span>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-[#22d3ee] transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>

      <p className="mt-3 text-sm leading-relaxed text-slate-300">{PROGRESS_COPY[progressKey]}</p>

      <ul className="mt-4 space-y-2">
        {rows.map((row) => (
          <li
            key={row.label}
            className="flex items-center justify-between rounded-lg border border-slate-700/50 bg-slate-900/40 px-3 py-2"
          >
            <span className="flex items-center gap-2 text-sm text-slate-200">
              <span
                aria-hidden
                className={`inline-block h-2.5 w-2.5 rounded-full ${
                  row.done ? "bg-[#22d3ee]" : "bg-slate-600"
                }`}
              />
              {row.label}
            </span>
            <span className="text-xs text-slate-400">{row.detail}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/app/capture"
          className="rounded-lg bg-[#22d3ee] px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-[#67e8f9]"
        >
          {DASHBOARD.widgetCta}
        </Link>
      </div>

      <div className="mt-4 border-t border-slate-700/50 pt-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          Quick actions
        </p>
        <div className="flex flex-wrap gap-2">
          {DASHBOARD.quickActions.map((label) => (
            <Link
              key={label}
              href={QUICK_ACTION_HREFS[label] ?? "/app"}
              className="rounded-full border border-slate-600 px-3 py-1 text-xs font-medium text-slate-300 transition hover:border-[#22d3ee]/50 hover:text-[#22d3ee]"
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
