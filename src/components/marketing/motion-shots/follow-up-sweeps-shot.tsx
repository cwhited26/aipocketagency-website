"use client";

// Shot C (PA-POS-26): Follow-Up Sweeps works the stale-contact list — a scan line sweeps
// the left column, drafts stack up in the Approval Inbox on the right. Composite names only.
import { m } from "framer-motion";
import { MOTION_LAYER } from "../motion-pref";
import { ShotFrame, useShotPlayback, useTimeline } from "./shot-frame";

const CONTACTS = [
  { name: "Jenny at Acme", last: "Last touch: 24 days ago", subject: "Following up on the trial", preview: "You asked for two weeks — checking where it landed." },
  { name: "Marcus at Beacon", last: "Last touch: 19 days ago", subject: "That rollout question", preview: "You mentioned a Q3 rollout. Still the plan?" },
  { name: "Sara at Delta", last: "Last touch: 31 days ago", subject: "Checking in after onboarding", preview: "How did the first month treat your team?" },
  { name: "Priya at Fieldstone", last: "Last touch: 17 days ago", subject: "The proposal you requested", preview: "Wanted to make sure the proposal reached you." },
  { name: "Tom at Harbor", last: "Last touch: 26 days ago", subject: "Winter schedule slots", preview: "Booking the winter schedule now — want your spot held?" },
];
// Beats: scan starts, one draft per contact, the done chip. +2s hold.
const MARKS = [400, 1400, 2400, 3400, 4400, 5400, 6600];
const TOTAL_MS = 11000;

function Scene({ playing, poster }: { playing: boolean; poster: boolean }) {
  const step = useTimeline(MARKS, playing, poster);
  return (
    <div className="grid min-h-[300px] grid-cols-2 gap-4">
      <div className="relative overflow-hidden rounded-xl border border-white/5 bg-white/[0.02] p-3">
        <p className="text-[11px] uppercase tracking-wider text-slate-500">Gone quiet</p>
        {!poster && step >= 1 && step < 7 && (
          // Full-height wrapper translated on y so the sweep stays transform-only —
          // animating `top` here forces a reflow per frame.
          <m.div
            className="pointer-events-none absolute inset-0"
            style={MOTION_LAYER}
            initial={{ y: 24 }}
            animate={{ y: "92%" }}
            transition={{ duration: 5, ease: "linear" }}
            aria-hidden
          >
            <span className="absolute inset-x-0 top-0 h-9 bg-gradient-to-b from-transparent via-accent/15 to-transparent" />
          </m.div>
        )}
        <ul className="mt-2 space-y-2">
          {CONTACTS.map((c, i) => (
            <li
              key={c.name}
              className={`rounded-lg border px-3 py-2 transition-colors ${
                step >= i + 2
                  ? "border-accent/25 bg-accent/[0.05]"
                  : "border-white/5 bg-white/[0.02]"
              }`}
            >
              <p className="text-[12px] font-medium text-slate-200">{c.name}</p>
              <p className="text-[11px] text-slate-500">{c.last}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
        <p className="text-[11px] uppercase tracking-wider text-slate-500">Approval Inbox</p>
        <ul className="mt-2 space-y-2">
          {CONTACTS.map((c, i) => {
            if (step < i + 2) return null;
            return (
              <m.li
                key={c.subject}
                style={MOTION_LAYER}
                initial={poster ? false : { opacity: 0, x: -18 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 26 }}
                className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2"
              >
                <p className="text-[12px] font-medium text-slate-200">{c.subject}</p>
                <p className="truncate text-[11px] text-slate-500">{c.preview}</p>
              </m.li>
            );
          })}
        </ul>
        {step >= 7 && (
          <m.p
            style={MOTION_LAYER}
            initial={poster ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 inline-block rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[11px] font-semibold text-accent"
          >
            5 drafts ready for your review
          </m.p>
        )}
      </div>
    </div>
  );
}

export function FollowUpSweepsShot() {
  const { frameRef, state, playing, poster, sceneKey } = useShotPlayback(TOTAL_MS);
  return (
    <ShotFrame
      ref={frameRef}
      shot="follow-up-sweeps"
      title="Follow-Up Sweeps — weekly run"
      cornerLabel="drafts wait for you"
      state={state}
    >
      <Scene key={sceneKey} playing={playing} poster={poster} />
    </ShotFrame>
  );
}
