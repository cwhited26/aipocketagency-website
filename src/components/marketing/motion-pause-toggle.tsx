"use client";

// The footer escape hatch: one click freezes every motion shot into its poster frame.
// Persisted in localStorage (no cookie) via motion-pref; the shots subscribe.
import { setMotionPaused, useMotionPaused } from "./motion-pref";

export function MotionPauseToggle() {
  const paused = useMotionPaused();
  return (
    <button
      type="button"
      data-motion-toggle
      aria-pressed={paused}
      onClick={() => setMotionPaused(!paused)}
      className="text-left text-xs text-slate-600 underline decoration-white/15 underline-offset-2 transition hover:text-slate-400 sm:text-right"
    >
      {paused ? "Play animations" : "Pause animations"}
    </button>
  );
}
