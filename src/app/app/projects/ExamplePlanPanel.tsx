"use client";

import { useState } from "react";

// An illustrative Project → Milestones → Tasks plan for a multi-step job, rendered in the same
// shape the agent stages a real plan. Collapsed by default so the page reads as copy first; the
// owner expands it when they want to see what a plan looks like. Non-interactive — the Approve /
// Change buttons are a preview of the real flow. Scope is honest to today's surface: it reads the
// brain, drafts in Gmail, and stages everything for approval. No whole-system build.
const EXAMPLE = {
  project: "Draft a five-touch follow-up sequence for the three prospects from my discovery calls this week",
  subhead: "Four milestones across your brain, Gmail, and Calendar. Nothing sends until you approve the drafts.",
  milestones: [
    {
      n: 1,
      title: "Pull the three prospects",
      tasks: [
        "Read your brain for this week's discovery-call notes",
        "Pull each prospect's context — what they care about, where you left off",
      ],
    },
    {
      n: 2,
      title: "Draft the five touches per prospect",
      tasks: [
        "Write five emails each, in your voice, spaced across the sequence",
        "Reference what they actually said, not a generic template",
      ],
    },
    {
      n: 3,
      title: "Stage everything for approval",
      tasks: [
        "Drop all fifteen drafts in your Inbox",
        "You read, edit, and approve before anything sends",
      ],
    },
    {
      n: 4,
      title: "Space out the sends",
      tasks: [
        "Set each touch on the calendar so the sequence paces itself",
        "Hold the next touch automatically if a prospect replies",
      ],
    },
  ],
};

export default function ExamplePlanPanel() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/70 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-slate-800/40 transition-colors min-h-[44px]"
      >
        <span
          className={`shrink-0 text-[#22d3ee]/70 text-xs transition-transform duration-150 ${
            open ? "rotate-90" : ""
          }`}
        >
          ▶
        </span>
        <span className="text-sm font-semibold text-slate-200">See an example plan</span>
        <span className="ml-auto text-[11px] font-mono text-slate-600 uppercase tracking-wider">
          {open ? "hide" : "show"}
        </span>
      </button>

      {open && (
        <div className="border-t border-slate-800/60 px-5 py-5">
          <div className="rounded-xl border border-slate-800/60 bg-slate-950/50 p-4 sm:p-5">
            <div className="text-[11px] font-mono text-slate-500 uppercase tracking-[0.14em]">
              The plan
            </div>
            <h3 className="mt-1 text-base font-semibold text-slate-100">{EXAMPLE.project}</h3>
            <p className="mt-1 text-sm text-slate-400">{EXAMPLE.subhead}</p>

            <ol className="mt-4 space-y-2.5">
              {EXAMPLE.milestones.map((m) => (
                <li
                  key={m.n}
                  className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-3.5"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-[#22d3ee]/30 bg-[#22d3ee]/10 text-[11px] font-semibold text-[#22d3ee]">
                      {m.n}
                    </span>
                    <span className="text-sm font-medium text-slate-100">{m.title}</span>
                    <span className="ml-auto text-[10px] font-mono uppercase tracking-wider text-slate-600">
                      waiting
                    </span>
                  </div>
                  <ul className="mt-2 space-y-1 pl-[30px]">
                    {m.tasks.map((t) => (
                      <li
                        key={t}
                        className="text-[13px] leading-relaxed text-slate-400 before:content-['–'] before:mr-2 before:text-slate-600"
                      >
                        {t}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-lg bg-[#22d3ee] px-3 py-1.5 text-xs font-semibold text-[#031820]">
                Approve plan
              </span>
              <span className="rounded-lg border border-slate-700/60 px-3 py-1.5 text-xs font-medium text-slate-300">
                Change a step
              </span>
            </div>
          </div>

          <p className="mt-3 text-[11px] font-mono text-slate-600 leading-relaxed">
            This is an example. Your real plans show up here once you hand your agent a multi-step
            job — and every one is shaped by what&apos;s in your brain.
          </p>
        </div>
      )}
    </div>
  );
}
