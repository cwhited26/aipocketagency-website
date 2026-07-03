"use client";

// Shot E (PA-POS-26): the Approval Inbox fills while you were heads-down — every card is
// work already done, waiting on your tap. The agents drafted; nothing went out.
import { motion } from "framer-motion";
import { ApprovalButtons, ShotFrame, useShotLoop, useTimeline } from "./shot-frame";

const CARDS = [
  { title: "Follow-up drafted for Jenny at Acme", meta: "Follow-Up Sweeps · Gmail draft" },
  { title: "New booking for 2pm Thursday", meta: "Calendar · needs your confirm" },
  { title: "Podcast episode notes ready to review", meta: "Podcast Ingester · filed to brain" },
  { title: "Lead Scout found 12 matches", meta: "Lead Scout · 12 openers staged" },
];
// One beat per card. +2.2s hold.
const MARKS = [800, 2000, 3200, 4400];
const TOTAL_MS = 9200;

function Scene({ active }: { active: boolean }) {
  const step = useTimeline(MARKS, active);
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
            <motion.li
              key={card.title}
              initial={active ? { opacity: 0, y: 22 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 26 }}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3"
            >
              <p className="text-[13px] font-medium text-slate-100">{card.title}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">{card.meta}</p>
              <div className="mt-2.5">
                <ApprovalButtons pulse={active && step === i + 1} />
              </div>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}

export function ApprovalInboxShot() {
  const { cycle, reduced } = useShotLoop(TOTAL_MS);
  return (
    <ShotFrame
      shot="approval-inbox"
      title="Mission Control — Approval Inbox"
      cornerLabel="you approve, it sends"
      reduced={reduced}
    >
      <Scene key={reduced ? "poster" : cycle} active={!reduced} />
    </ShotFrame>
  );
}
