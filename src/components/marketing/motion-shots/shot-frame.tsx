"use client";

// Shared chrome + playback gating for the motion product shots (PA-POS-26). Every shot is
// HTML + CSS + framer-motion — no video files. Playback is viewport-gated: a shot idles on
// its poster frame until it first enters the viewport, freezes in place (timers cleared,
// frame held) whenever it scrolls out, and resumes where it left off when it comes back.
// A shot loops by remounting its scene each cycle; prefers-reduced-motion and the footer
// "Pause animations" toggle pin the finished poster frame and never start a timer.
import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { LazyMotion, domAnimation, useInView } from "framer-motion";
import { MONO_FONT } from "../cta";
import { useMotionPaused, usePrefersReducedMotion } from "../motion-pref";

/**
 * The smoke-test contract on `data-motion`: "idle" before the shot ever enters the
 * viewport, "playing" while it runs, "paused" when it scrolled out (or the owner hit
 * Pause animations), "reduced" when prefers-reduced-motion pinned the poster frame.
 */
export type MotionState = "idle" | "playing" | "paused" | "reduced";

type MotionGate = {
  frameRef: RefObject<HTMLDivElement>;
  state: MotionState;
  playing: boolean;
  /** True when the finished poster frame is pinned (idle / reduced / owner-paused). */
  poster: boolean;
};

/**
 * Viewport + preference gate for one shot. The IntersectionObserver (framer's useInView)
 * starts playback the first time the frame enters the viewport and pauses it whenever it
 * leaves — off-screen shots consume zero frames.
 */
export function useMotionGate(): MotionGate {
  const frameRef = useRef<HTMLDivElement>(null);
  const inView = useInView(frameRef, { amount: 0.2 });
  const reduced = usePrefersReducedMotion();
  const pausedByOwner = useMotionPaused();
  const [started, setStarted] = useState(false);
  useEffect(() => {
    if (inView && !reduced && !pausedByOwner) setStarted(true);
  }, [inView, reduced, pausedByOwner]);
  const state: MotionState = reduced
    ? "reduced"
    : pausedByOwner
      ? "paused"
      : !started
        ? "idle"
        : inView
          ? "playing"
          : "paused";
  return {
    frameRef,
    state,
    playing: state === "playing",
    poster: reduced || pausedByOwner || !started,
  };
}

/**
 * The gate plus the shot's cycle loop: the scene remounts every `totalMs` while playing,
 * and the countdown freezes with the shot — a paused cycle picks up where it stopped.
 * `sceneKey` keys the scene: "poster" pins the finished frame, the cycle count restarts it.
 */
export function useShotPlayback(totalMs: number): MotionGate & { sceneKey: string } {
  const gate = useMotionGate();
  const [cycle, setCycle] = useState(0);
  const elapsedRef = useRef(0);
  useEffect(() => {
    if (!gate.playing) return;
    const resumedAt = performance.now();
    let completed = false;
    const t = setTimeout(() => {
      completed = true;
      elapsedRef.current = 0;
      setCycle((c) => c + 1);
    }, Math.max(0, totalMs - elapsedRef.current));
    return () => {
      clearTimeout(t);
      if (!completed) elapsedRef.current += performance.now() - resumedAt;
    };
  }, [gate.playing, cycle, totalMs]);
  return { ...gate, sceneKey: gate.poster ? "poster" : `cycle-${cycle}` };
}

/**
 * Step counter for a scene: how many of `marksMs` have elapsed since the scene mounted,
 * counting only time spent playing. With `poster` true it starts — and stays — at the end.
 */
export function useTimeline(marksMs: number[], playing: boolean, poster: boolean): number {
  const [step, setStep] = useState(poster ? marksMs.length : 0);
  const elapsedRef = useRef(0);
  useEffect(() => {
    if (!playing) return;
    const resumedAt = performance.now();
    const timers = marksMs.flatMap((ms, i) =>
      ms > elapsedRef.current
        ? [setTimeout(() => setStep((s) => (s < i + 1 ? i + 1 : s)), ms - elapsedRef.current)]
        : [],
    );
    return () => {
      timers.forEach(clearTimeout);
      elapsedRef.current += performance.now() - resumedAt;
    };
    // marksMs is a constant per shot; scenes remount (key=sceneKey) to restart.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);
  return step;
}

/**
 * Character-by-character text. `poster` renders the full text at once; a pause freezes
 * the typed prefix in place and resumes from the same character.
 */
export function Typewriter({
  text,
  cps = 36,
  playing,
  poster,
  className = "",
}: {
  text: string;
  cps?: number;
  playing: boolean;
  poster: boolean;
  className?: string;
}) {
  const [shown, setShown] = useState(poster ? text.length : 0);
  useEffect(() => {
    if (!playing) return;
    const interval = setInterval(() => {
      setShown((n) => {
        if (n >= text.length) {
          clearInterval(interval);
          return n;
        }
        return n + 1;
      });
    }, 1000 / cps);
    return () => clearInterval(interval);
  }, [playing, text, cps]);
  return <span className={className}>{text.slice(0, shown)}</span>;
}

/**
 * The window the scene plays in. `data-motion` is the smoke-test hook (see MotionState).
 * The scene subtree runs on LazyMotion's domAnimation bundle — shots use `m.*`
 * components, never the full `motion` import.
 */
export const ShotFrame = forwardRef<
  HTMLDivElement,
  {
    shot: string;
    title: string;
    cornerLabel: string;
    state: MotionState;
    children: ReactNode;
  }
>(function ShotFrame({ shot, title, cornerLabel, state, children }, ref) {
  return (
    <div
      ref={ref}
      data-shot={shot}
      data-motion={state}
      className="overflow-hidden rounded-2xl border border-white/10 bg-[#0a0d13] shadow-2xl"
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className="flex gap-1.5" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
          </span>
          <span className="text-xs font-medium text-slate-400">{title}</span>
        </div>
        <span
          className="text-[10px] uppercase tracking-wider text-slate-600"
          style={{ fontFamily: MONO_FONT }}
        >
          {cornerLabel}
        </span>
      </div>
      <div className="relative p-4 sm:p-5">
        <LazyMotion features={domAnimation} strict>
          {children}
        </LazyMotion>
      </div>
    </div>
  );
});

/** The Approve / Edit / Reject row every staged draft carries. */
export function ApprovalButtons({ pulse = false }: { pulse?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`rounded-md bg-accent px-2.5 py-1 text-[11px] font-semibold text-accent-foreground ${
          pulse ? "animate-pulse" : ""
        }`}
        style={pulse ? { willChange: "opacity" } : undefined}
      >
        Approve
      </span>
      <span className="rounded-md border border-white/15 px-2.5 py-1 text-[11px] text-slate-300">
        Edit
      </span>
      <span className="rounded-md border border-white/15 px-2.5 py-1 text-[11px] text-slate-500">
        Reject
      </span>
    </div>
  );
}
