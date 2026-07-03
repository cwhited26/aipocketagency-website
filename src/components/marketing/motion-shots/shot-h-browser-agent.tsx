"use client";

// Shot H (PA-POS-29 companion, §14.9): the Browser Agent working a tool that has no API.
// A hosted browser opens a CRM contact list, the proposed click is spelled out in an amber
// step pill, the cursor moves to the target — and the caption carries the real product rule:
// every irreversible step is approved by the owner before it runs (PA-POS-21).
import { m } from "framer-motion";
import { MONO_FONT } from "../cta";
import { MOTION_LAYER } from "../motion-pref";
import { ShotFrame, useShotPlayback, useTimeline } from "./shot-frame";

// Composite contacts only (PA-POS-13) — the generic CRM-list treatment, not any real
// vendor's UI.
const ROWS = [
  { name: "Jenny Alvarez", company: "Acme Renovations", age: "no reply · 21d" },
  { name: "Marcus Boone", company: "Boone Fitness Studio", age: "no reply · 19d" },
  { name: "Priya Natarajan", company: "Lakeview Med Spa", age: "no reply · 17d" },
  { name: "Dale Whitfield", company: "Whitfield & Sons Roofing", age: "no reply · 16d" },
  { name: "Sofia Reyes", company: "Reyes Property Group", age: "no reply · 15d" },
] as const;

const TARGET_ROW = 2;

// Beats: page settles, step pill in, cursor travels ~2s, target button pulses, hold.
const MARKS = [400, 1200, 3300, 3800];
const TOTAL_MS = 8600;

// Cursor path across the stage: top-right in, down to the target row's action button.
// The x/y percentages translate a stage-sized wrapper, so the travel stays transform-only —
// animating `left`/`top` here forces a reflow per frame.
const CURSOR_FROM = { x: "88%", y: "6%" };
const CURSOR_TO = { x: "78%", y: "56%" };

function CursorArrow() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 drop-shadow" aria-hidden>
      <path
        d="M5 3l14 8.5-6.2 1.3L10.5 19 5 3Z"
        fill="#F5F5F4"
        stroke="#05070a"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function Scene({ playing, poster }: { playing: boolean; poster: boolean }) {
  const step = useTimeline(MARKS, playing, poster);
  return (
    <div className="relative">
      {/* Browser chrome — URL bar + the owner's Cancel. */}
      <div className="flex items-center gap-2 rounded-t-xl border border-white/10 bg-white/[0.04] px-3 py-2">
        <span
          className="min-w-0 flex-1 truncate rounded-md border border-white/10 bg-black/40 px-2.5 py-1 text-[11px] text-slate-400"
          style={{ fontFamily: MONO_FONT }}
        >
          https://app.hubspot.com/contacts/
        </span>
        <span className="rounded-md border border-white/15 px-2.5 py-1 text-[11px] text-slate-300">
          Cancel
        </span>
      </div>

      {/* The page inside the hosted browser — a generic CRM contact list. */}
      <div className="relative min-h-[280px] rounded-b-xl border border-t-0 border-white/10 bg-[#0d1118] p-3">
        <div
          className="flex items-center justify-between px-2 pb-2 text-[10px] uppercase tracking-wider text-slate-600"
          style={{ fontFamily: MONO_FONT }}
        >
          <span>contacts · stale</span>
          <span>5 selected</span>
        </div>
        <ul className="space-y-1.5">
          {ROWS.map((row, i) => {
            const isTarget = i === TARGET_ROW;
            return (
              <li
                key={row.name}
                className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${
                  isTarget && step >= 4
                    ? "border-amber-300/30 bg-amber-400/[0.04]"
                    : "border-white/5 bg-white/[0.02]"
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-medium text-slate-200">{row.name}</p>
                  <p className="truncate text-[11px] text-slate-500">
                    {row.company} · {row.age}
                  </p>
                </div>
                <m.span
                  data-target-button={isTarget || undefined}
                  style={isTarget ? MOTION_LAYER : undefined}
                  initial={false}
                  animate={
                    isTarget && step >= 4 && playing
                      ? { scale: [1, 1.07, 1] }
                      : { scale: 1 }
                  }
                  transition={
                    isTarget && step >= 4 && playing
                      ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" }
                      : { duration: 0 }
                  }
                  className={`shrink-0 rounded-md border px-2 py-1 text-[10px] ${
                    isTarget && step >= 4
                      ? "border-amber-300/50 bg-amber-400/15 text-amber-200"
                      : "border-white/10 text-slate-400"
                  }`}
                >
                  Add to sequence
                </m.span>
              </li>
            );
          })}
        </ul>

        {/* The proposed step — the amber pill the owner approved. */}
        {step >= 2 && (
          <m.div
            style={MOTION_LAYER}
            initial={poster ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute right-3 top-[38%] max-w-[220px] rounded-lg border border-amber-300/40 bg-[#1a1508] px-3 py-2 shadow-lg"
          >
            <p className="text-[11px] leading-snug text-amber-200">
              Click &ldquo;Add to sequence&rdquo; for 5 stale leads
            </p>
            <span
              className="absolute -bottom-1.5 right-8 h-3 w-3 rotate-45 border-b border-r border-amber-300/40 bg-[#1a1508]"
              aria-hidden
            />
          </m.div>
        )}

        {/* The cursor, driven by the agent — a stage-sized wrapper translated to the
            target over ~2s, so only the compositor moves; the arrow rides its corner. */}
        {step >= 2 && (
          <m.div
            className="pointer-events-none absolute inset-0 z-10"
            style={MOTION_LAYER}
            initial={poster ? false : CURSOR_FROM}
            animate={CURSOR_TO}
            transition={poster ? { duration: 0 } : { duration: 2, ease: "easeInOut" }}
            aria-hidden
          >
            <CursorArrow />
          </m.div>
        )}
      </div>
    </div>
  );
}

export function BrowserAgentShot() {
  const { frameRef, state, playing, poster, sceneKey } = useShotPlayback(TOTAL_MS);
  return (
    <div>
      <ShotFrame
        ref={frameRef}
        shot="browser-agent"
        title="Browser Agent — hosted browser"
        cornerLabel="you approve each step"
        state={state}
      >
        <Scene key={sceneKey} playing={playing} poster={poster} />
      </ShotFrame>
      <p className="mt-3 text-[12px] leading-relaxed text-slate-500">
        Every irreversible action shows you the screenshot + reasoning + reversible/irreversible
        tag BEFORE it runs. You approve or reject each step.
      </p>
    </div>
  );
}
