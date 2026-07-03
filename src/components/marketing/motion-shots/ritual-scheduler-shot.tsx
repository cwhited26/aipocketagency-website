"use client";

// Shot D (PA-POS-26): a Ritual fires on schedule — the clock hits Monday 8:00, the weekly
// job runs, and the drafts it produced fill in beneath it. You set it once.
import { m } from "framer-motion";
import { MOTION_LAYER } from "../motion-pref";
import { ShotFrame, useShotPlayback, useTimeline } from "./shot-frame";
import { MONO_FONT } from "../cta";

const DRAFTS = [
  "Draft 1 — Ridgeline: proposal follow-up before Thursday's committee",
  "Draft 2 — Beacon: rollout check-in, Q3 timing",
  "Draft 3 — Harbor: winter schedule hold, second nudge",
];
// Beats: clock flips to 8:00, the ritual card fires, three drafts fill in. +2s hold.
const MARKS = [1500, 2300, 3400, 4300, 5200];
const TOTAL_MS = 9600;

function Scene({ playing, poster }: { playing: boolean; poster: boolean }) {
  const step = useTimeline(MARKS, playing, poster);
  return (
    <div className="flex min-h-[300px] flex-col">
      <div className="flex justify-end">
        <span
          className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[12px] text-slate-300"
          style={{ fontFamily: MONO_FONT }}
        >
          MON {step >= 1 ? "8:00" : "7:59"} AM
        </span>
      </div>

      <div className="mt-auto">
        {step >= 2 && (
          <m.div
            style={MOTION_LAYER}
            initial={poster ? false : { opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 240, damping: 24 }}
            className="rounded-xl border border-accent/25 bg-accent/[0.06] px-4 py-3"
          >
            <p className="text-[11px] uppercase tracking-wider text-accent/70" style={{ fontFamily: MONO_FONT }}>
              ritual fired
            </p>
            <p className="mt-1 text-[14px] font-semibold text-slate-100">Weekly Pipeline Review</p>
          </m.div>
        )}
        <ul className="mt-2.5 space-y-2">
          {DRAFTS.map((d, i) => {
            if (step < i + 3) return null;
            return (
              <m.li
                key={d}
                style={MOTION_LAYER}
                initial={poster ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-[12px] text-slate-300"
              >
                {d}
              </m.li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export function RitualSchedulerShot() {
  const { frameRef, state, playing, poster, sceneKey } = useShotPlayback(TOTAL_MS);
  return (
    <ShotFrame
      ref={frameRef}
      shot="ritual-scheduler"
      title="Ritual Scheduler — Monday, on time"
      cornerLabel="set once, runs weekly"
      state={state}
    >
      <Scene key={sceneKey} playing={playing} poster={poster} />
    </ShotFrame>
  );
}
