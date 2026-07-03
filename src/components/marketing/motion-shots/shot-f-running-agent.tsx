"use client";

// Shot F (PA-POS-29 companion, §14.9): a running agent with a checked step-list. The
// Follow-Up Sweep Runner works a job — five steps stream in, every draft lands in the
// Approval Inbox, nothing sends itself. Sidebar tabs are real Agents Library entries.
import { m } from "framer-motion";
import { MONO_FONT } from "../cta";
import { MOTION_LAYER } from "../motion-pref";
import { ShotFrame, Typewriter, useShotPlayback, useTimeline } from "./shot-frame";

// Five real agents from the shipped library (src/data/agents-library) — never invented.
const TABS = [
  "Follow-Up Sweep Runner",
  "Lead Scout — Contractors",
  "Pipeline Review Manager",
  "Daily Brief Writer",
  "Invoice Chaser",
];

const PROMPT = "Run today's follow-up sweep — target contacts with no reply in 14 days";

const STEPS = [
  "Searched Gmail for stale contacts past 14 days",
  "Pulled brand-voice from Business Brain",
  "Drafted 5 follow-ups tuned to each relationship",
  "Staged all 5 in Approval Inbox",
  "Sent Slack digest to owner",
];

// Beats: prompt in, running line, collapsed branch, expanded branch opens, five steps at
// ~600ms, the done line.
const MARKS = [300, 1100, 1800, 2400, 3000, 3600, 4200, 4800, 5400, 6200];
const TOTAL_MS = 10800;

function Scene({ playing, poster }: { playing: boolean; poster: boolean }) {
  const step = useTimeline(MARKS, playing, poster);
  const stepsShown = Math.max(0, Math.min(STEPS.length, step - 4));
  return (
    <div className="flex min-h-[320px] gap-4">
      {/* Left rail — the agent tabs. */}
      <div className="hidden w-44 shrink-0 flex-col gap-1 border-r border-white/5 pr-3 sm:flex">
        <p
          className="mb-1 text-[10px] uppercase tracking-wider text-slate-600"
          style={{ fontFamily: MONO_FONT }}
        >
          your agents
        </p>
        {TABS.map((tab, i) => (
          <span
            key={tab}
            className={`rounded-lg px-2.5 py-1.5 text-[12px] leading-snug ${
              i === 0
                ? "bg-white/[0.06] font-medium text-cyan-200"
                : "text-slate-500"
            }`}
          >
            {tab}
          </span>
        ))}
      </div>

      {/* Center — the agent workspace. */}
      <div className="flex min-w-0 flex-1 flex-col">
        {step >= 1 && (
          <m.div
            style={MOTION_LAYER}
            initial={poster ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="self-end rounded-2xl rounded-br-sm bg-accent/15 px-3.5 py-2 text-[13px] text-slate-100"
          >
            <Typewriter text={PROMPT} playing={playing} poster={poster} cps={60} />
          </m.div>
        )}

        {step >= 2 && (
          <m.div
            style={MOTION_LAYER}
            initial={poster ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-3 flex items-center gap-2 text-[12px] text-slate-400"
          >
            <span aria-hidden>⚙️</span>
            <span>Running — searching Gmail, drafting, staging in inbox.</span>
          </m.div>
        )}

        {/* Branch 1 — collapsed. The scan pass that fed the drafting branch. */}
        {step >= 3 && (
          <m.div
            style={MOTION_LAYER}
            initial={poster ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2.5 flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] px-3.5 py-2.5 text-[12px] text-slate-500"
          >
            <span aria-hidden>▸</span>
            <span>Contact scan — 42 checked, 5 past 14 days</span>
            <span className="ml-auto text-cyan-300/70" aria-hidden>
              ✓
            </span>
          </m.div>
        )}

        {/* Branch 2 — expanded, the steps streaming in. */}
        {step >= 4 && (
          <m.div
            style={MOTION_LAYER}
            initial={poster ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-3.5"
          >
            <div className="flex items-center gap-2 text-[12px] text-slate-300">
              <span aria-hidden>▾</span>
              <span className="font-medium">Draft follow-ups</span>
              <span className="text-slate-600">— expanded</span>
            </div>
            <ul className="mt-2.5 space-y-1.5">
              {STEPS.map((line, i) => {
                if (stepsShown < i + 1) return null;
                return (
                  <m.li
                    key={line}
                    style={MOTION_LAYER}
                    initial={poster ? false : { opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-start gap-2 text-[12px] leading-relaxed text-slate-400"
                  >
                    <span className="mt-px text-cyan-300" aria-hidden>
                      ✓
                    </span>
                    <span>{line}</span>
                  </m.li>
                );
              })}
            </ul>
            {step >= 10 && (
              <m.p
                style={MOTION_LAYER}
                initial={poster ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-3 border-t border-white/5 pt-2.5 text-[13px] font-medium text-slate-100"
              >
                5 drafts ready for your approval.
              </m.p>
            )}
          </m.div>
        )}

        {/* Play bar — the five-workspace cycle indicator. Segment one fills as the scene runs. */}
        <div className="mt-auto flex items-center gap-1.5 pt-4" aria-hidden>
          {TABS.map((tab, i) => (
            <span
              key={tab}
              className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.06]"
            >
              {i === 0 && (
                <m.span
                  style={MOTION_LAYER}
                  initial={poster ? false : { scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={poster ? { duration: 0 } : { duration: TOTAL_MS / 1000, ease: "linear" }}
                  className="block h-full origin-left rounded-full bg-cyan-300/60"
                />
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function RunningAgentShot() {
  const { frameRef, state, playing, poster, sceneKey } = useShotPlayback(TOTAL_MS);
  return (
    <ShotFrame
      ref={frameRef}
      shot="running-agent"
      title="Pocket Agent — agents at work"
      cornerLabel="brain · your GitHub repo"
      state={state}
    >
      <Scene key={sceneKey} playing={playing} poster={poster} />
    </ShotFrame>
  );
}
