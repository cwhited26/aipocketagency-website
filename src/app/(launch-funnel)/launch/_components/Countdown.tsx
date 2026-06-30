"use client";

import { useEffect, useState } from "react";
import {
  COUNTDOWN_STORAGE_KEY,
  formatCountdown,
  remainingSeconds,
  resolveDeadline,
} from "@/lib/launch-funnel/countdown";
import { MONO_FONT } from "@/lib/launch-funnel/copy";

// The "LIMITED-TIME OFFER 15:00" timer. The deadline is persisted as one absolute timestamp in
// localStorage, so a refresh or back-nav resumes the same countdown instead of restarting it.
// Renders nothing until mounted to avoid a server/client hydration mismatch on the clock.
export default function Countdown() {
  const [seconds, setSeconds] = useState<number | null>(null);

  useEffect(() => {
    let deadline: number;
    try {
      const stored = window.localStorage.getItem(COUNTDOWN_STORAGE_KEY);
      deadline = resolveDeadline(stored, Date.now());
      window.localStorage.setItem(COUNTDOWN_STORAGE_KEY, String(deadline));
    } catch {
      // Private mode / blocked storage — fall back to a fresh in-memory deadline.
      deadline = resolveDeadline(null, Date.now());
    }
    const tick = () => setSeconds(remainingSeconds(deadline, Date.now()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  if (seconds === null) return null;

  return (
    <div
      className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/[0.08] px-3 py-1.5 text-xs font-semibold text-amber-200"
      style={{ fontFamily: MONO_FONT }}
    >
      <span className="uppercase tracking-wider">Limited-time offer</span>
      <span className="tabular-nums text-amber-100">
        {formatCountdown(seconds)}
      </span>
    </div>
  );
}
