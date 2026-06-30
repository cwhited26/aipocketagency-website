// Pure pause-state helpers. The popover's "Pause for 1 hour" / "Pause until tomorrow" actions store
// an ISO deadline in config; the watchers consult isCapturePaused on every tick. No Electron imports.

/** True when capture is currently paused (pausedUntil is set and still in the future). */
export function isCapturePaused(pausedUntil: string | null | undefined, now: Date): boolean {
  if (!pausedUntil) return false;
  const t = Date.parse(pausedUntil);
  if (Number.isNaN(t)) return false;
  return t > now.getTime();
}

/** An ISO deadline one hour from now. */
export function pauseForOneHour(now: Date): string {
  return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
}

/** An ISO deadline at the start of tomorrow (local midnight). */
export function pauseUntilTomorrow(now: Date): string {
  const d = new Date(now.getTime());
  d.setHours(24, 0, 0, 0);
  return d.toISOString();
}
