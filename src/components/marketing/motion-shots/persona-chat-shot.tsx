"use client";

// Shot A (PA-POS-26): a Persona works a request in chat — user asks, the agent narrates
// what it's reading, then a draft lands as an approval card. Nothing sends itself.
import { m } from "framer-motion";
import { PersonaAvatar } from "@/components/personas/avatar";
import { MOTION_LAYER } from "../motion-pref";
import {
  ApprovalButtons,
  ShotFrame,
  Typewriter,
  useShotPlayback,
  useTimeline,
} from "./shot-frame";

const USER_ASK = "draft a follow-up to Jenny at Acme";
const STATUS_LINES = [
  { at: 2200, text: "Reading your last 3 emails with Jenny…" },
  { at: 4200, text: "Pulling context on the Acme trial from your Brain…" },
  { at: 6200, text: "Drafting in your voice…" },
];
// Scene beats: user bubble in, three status lines, draft card. +2s hold before the loop restarts.
const MARKS = [200, 2200, 4200, 6200, 8200];
const TOTAL_MS = 12600;

function Scene({ playing, poster }: { playing: boolean; poster: boolean }) {
  const step = useTimeline(MARKS, playing, poster);
  return (
    <div className="flex min-h-[300px] flex-col gap-3">
      {step >= 1 && (
        <m.div
          style={MOTION_LAYER}
          initial={poster ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="self-end rounded-2xl rounded-br-sm bg-accent/15 px-3.5 py-2 text-[13px] text-slate-100"
        >
          <Typewriter text={USER_ASK} playing={playing} poster={poster} cps={26} />
        </m.div>
      )}

      {step >= 2 && (
        <div className="flex items-start gap-2.5">
          <PersonaAvatar slug="admin" size="sm" alt="Admin Assistant" />

          <div className="space-y-1.5 pt-1">
            {STATUS_LINES.map((line, i) => {
              if (step < i + 2) return null;
              return (
                <m.p
                  key={line.text}
                  style={MOTION_LAYER}
                  initial={poster ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-[12px] text-slate-500"
                >
                  <Typewriter text={line.text} playing={playing} poster={poster} cps={40} />
                </m.p>
              );
            })}
          </div>
        </div>
      )}

      {step >= 5 && (
        <m.div
          style={MOTION_LAYER}
          initial={poster ? false : { opacity: 0, y: 14, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          className="ml-9 rounded-xl border border-white/10 bg-white/[0.03] p-3.5"
        >
          <p className="text-[11px] uppercase tracking-wider text-slate-500">Draft — waiting on you</p>
          <p className="mt-2 text-[13px] font-semibold text-slate-100">
            Subject: Following up on the Acme trial
          </p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-slate-400">
            Hi Jenny — you asked for two weeks with the reporting add-on. That was 16 days ago,
            so I wanted to check where it landed for your team…
          </p>
          <div className="mt-3 flex items-center justify-between gap-3">
            <ApprovalButtons pulse={playing} />
          </div>
        </m.div>
      )}
    </div>
  );
}

export function PersonaChatShot() {
  const { frameRef, state, playing, poster, sceneKey } = useShotPlayback(TOTAL_MS);
  return (
    <ShotFrame
      ref={frameRef}
      shot="persona-chat"
      title="Admin Assistant — chat"
      cornerLabel="brain · your GitHub repo"
      state={state}
    >
      <Scene key={sceneKey} playing={playing} poster={poster} />
    </ShotFrame>
  );
}
