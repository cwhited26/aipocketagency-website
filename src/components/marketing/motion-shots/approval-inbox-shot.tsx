"use client";

// Shot E (PA-POS-26): the Approval Inbox fills while you were heads-down — every card is
// work already done, waiting on your tap. The agents drafted; nothing went out.
import { m } from "framer-motion";
import { MOTION_LAYER } from "../motion-pref";
import { ApprovalButtons, ShotFrame, useShotPlayback, useTimeline } from "./shot-frame";

const CARDS = [
  { title: "Follow-up drafted for Jenny at Acme", meta: "Follow-Up Sweeps · Gmail draft" },
  { title: "New booking for 2pm Thursday", meta: "Calendar · needs your confirm" },
  { title: "Podcast episode notes ready to review", meta: "Podcast Ingester · filed to brain" },
  { title: "Lead Scout found 12 matches", meta: "Lead Scout · 12 openers staged" },
];
// One beat per card. +2.2s hold.
const MARKS = [800, 2000, 3200, 4400];
const TOTAL_MS = 9200;

function Scene({ playing, poster }: { playing: boolean; poster: boolean }) {
  const step = useTimeline(MARKS, playing, poster);
  return (
    <div className="flex min-h-[300px] flex-col">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-wider text-slate-500">Approval Inbox</p>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[11px] text-slate-400">
          {step} waiting
        </span>
      </div>
      <ul className="mt-3 space-y-2.5">
        {CARDS.map((card, i) => {
          if (step < i + 1) return null;
          return (
            <m.li
              key={card.title}
              style={MOTION_LAYER}
              initial={poster ? false : { opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 26 }}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3"
            >
              <p className="text-[13px] font-medium text-slate-100">{card.title}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">{card.meta}</p>
              <div className="mt-2.5">
                <ApprovalButtons pulse={playing && step === i + 1} />
              </div>
            </m.li>
          );
        })}
      </ul>
    </div>
  );
}

export function ApprovalInboxShot() {
  const { frameRef, state, playing, poster, sceneKey } = useShotPlayback(TOTAL_MS);
  return (
    <ShotFrame
      ref={frameRef}
      shot="approval-inbox"
      title="Mission Control — Approval Inbox"
      cornerLabel="you approve, it sends"
      state={state}
    >
      <Scene key={sceneKey} playing={playing} poster={poster} />
    </ShotFrame>
  );
}
