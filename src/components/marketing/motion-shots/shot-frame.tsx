"use client";

// Shared chrome for the motion product shots (PA-POS-26). Every shot is HTML + CSS +
// framer-motion — no video files. A shot loops by remounting its scene each cycle;
// prefers-reduced-motion renders the finished poster frame instead and never starts a timer.
import { useEffect, useState, type ReactNode } from "react";
import { useReducedMotion } from "framer-motion";
import { MONO_FONT } from "../cta";

/** Remounts the scene every `totalMs` (scene runtime + hold). Reduced motion never cycles. */
export function useShotLoop(totalMs: number): { cycle: number; reduced: boolean } {
  const reduced = useReducedMotion() ?? false;
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const t = setTimeout(() => setCycle((c) => c + 1), totalMs);
    return () => clearTimeout(t);
  }, [cycle, reduced, totalMs]);
  return { cycle, reduced };
}

/**
 * Step counter for a scene: returns how many of `marksMs` have elapsed since mount.
 * With `active` false (the reduced-motion poster) it starts — and stays — at the end.
 */
export function useTimeline(marksMs: number[], active: boolean): number {
  const [step, setStep] = useState(active ? 0 : marksMs.length);
  useEffect(() => {
    if (!active) return;
    const timers = marksMs.map((ms, i) => setTimeout(() => setStep(i + 1), ms));
    return () => timers.forEach(clearTimeout);
    // marksMs is a constant per shot; scenes remount (key=cycle) to restart.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
  return step;
}

/** Character-by-character text. `active` false renders the full text at once. */
export function Typewriter({
  text,
  startMs = 0,
  cps = 36,
  active,
  className = "",
}: {
  text: string;
  startMs?: number;
  cps?: number;
  active: boolean;
  className?: string;
}) {
  const [shown, setShown] = useState(active ? 0 : text.length);
  useEffect(() => {
    if (!active) return;
    let interval: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      interval = setInterval(() => {
        setShown((n) => {
          if (n >= text.length) {
            if (interval) clearInterval(interval);
            return n;
          }
          return n + 1;
        });
      }, 1000 / cps);
    }, startMs);
    return () => {
      clearTimeout(start);
      if (interval) clearInterval(interval);
    };
  }, [active, text, startMs, cps]);
  return <span className={className}>{text.slice(0, shown)}</span>;
}

/**
 * The window the scene plays in. `data-motion` is the smoke-test hook: "playing" when the
 * loop runs, "reduced" when prefers-reduced-motion pinned the poster frame.
 */
export function ShotFrame({
  shot,
  title,
  cornerLabel,
  reduced,
  children,
}: {
  shot: string;
  title: string;
  cornerLabel: string;
  reduced: boolean;
  children: ReactNode;
}) {
  return (
    <div
      data-shot={shot}
      data-motion={reduced ? "reduced" : "playing"}
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
      <div className="relative p-4 sm:p-5">{children}</div>
    </div>
  );
}

/** The Approve / Edit / Reject row every staged draft carries. */
export function ApprovalButtons({ pulse = false }: { pulse?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`rounded-md bg-accent px-2.5 py-1 text-[11px] font-semibold text-accent-foreground ${
          pulse ? "animate-pulse" : ""
        }`}
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
