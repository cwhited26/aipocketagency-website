"use client";

// Shot B (PA-POS-26): the Idea Engine ships an MVP — six build stages light up in
// sequence, then the live link slides in. The stage labels are the product's own UI;
// everything lands on the owner's accounts.
import { m } from "framer-motion";
import { MOTION_LAYER } from "../motion-pref";
import { ShotFrame, useShotPlayback, useTimeline } from "./shot-frame";
import { MONO_FONT } from "../cta";

const STAGES = [
  "Blueprint",
  "GitHub repo",
  "Push files",
  "Vercel project",
  "Env vars",
  "Deploy",
];
// One beat per stage, then the URL card. +2.5s hold.
const MARKS = [400, 1700, 3000, 4300, 5600, 6900, 8400];
const TOTAL_MS = 12400;

function Spinner() {
  return (
    <m.span
      style={MOTION_LAYER}
      className="h-3.5 w-3.5 rounded-full border-2 border-accent/30 border-t-accent"
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
    />
  );
}

function Check() {
  return (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 text-emerald-400" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 111.4-1.4l3.8 3.8 6.8-6.8a1 1 0 011.4 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function Scene({ playing, poster }: { playing: boolean; poster: boolean }) {
  const step = useTimeline(MARKS, playing, poster);
  return (
    <div className="flex min-h-[300px] flex-col justify-between">
      <ol className="space-y-2.5">
        {STAGES.map((stage, i) => {
          const state = step > i + 1 ? "done" : step === i + 1 ? "running" : "queued";
          return (
            <li key={stage} className="flex items-center gap-3">
              <span className="grid h-6 w-6 place-items-center rounded-full border border-white/10 bg-white/[0.03]">
                {state === "done" ? (
                  <Check />
                ) : state === "running" && playing ? (
                  <Spinner />
                ) : state === "running" ? (
                  <Check />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-white/15" />
                )}
              </span>
              <span
                className={`text-[13px] ${
                  state === "queued" ? "text-slate-600" : "text-slate-200"
                }`}
                style={{ fontFamily: MONO_FONT }}
              >
                {stage}
              </span>
              {state === "running" && (
                <span className="text-[11px] text-slate-500">working…</span>
              )}
            </li>
          );
        })}
      </ol>

      {step >= 7 && (
        <m.div
          style={MOTION_LAYER}
          initial={poster ? false : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 24 }}
          className="mt-4 flex items-center justify-between rounded-xl border border-emerald-400/25 bg-emerald-400/[0.06] px-4 py-3"
        >
          <span className="text-[13px] text-slate-100" style={{ fontFamily: MONO_FONT }}>
            acme-booking.vercel.app
          </span>
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Live
          </span>
        </m.div>
      )}
    </div>
  );
}

export function IdeaEngineShot() {
  const { frameRef, state, playing, poster, sceneKey } = useShotPlayback(TOTAL_MS);
  return (
    <ShotFrame
      ref={frameRef}
      shot="idea-engine"
      title="Idea Engine — shipping your MVP"
      cornerLabel="on your GitHub + Vercel"
      state={state}
    >
      <Scene key={sceneKey} playing={playing} poster={poster} />
    </ShotFrame>
  );
}
