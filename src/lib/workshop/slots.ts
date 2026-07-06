// lib/workshop/slots.ts — evergreen session scheduling (PA-POS-38 §24.4). Pure time math, no
// framework imports, unit-tested directly.
//
// Three slots a day at fixed local hours, auto-populated for the next seven days in the visitor's
// detected timezone. The slot id IS the ISO timestamp — no slot table; a slot exists because the
// attendee picked it. The lobby unlocks at T-15 minutes; the player runs from T-0.

/** Local start hours for the three daily sessions (9am, 1pm, 7pm attendee-local). */
export const SLOT_LOCAL_HOURS = [9, 13, 19] as const;

/** How many days of slots the picker shows. */
export const SLOT_WINDOW_DAYS = 7;

/** Lobby opens this many minutes before the slot. */
export const LOBBY_OPEN_MINUTES = 15;

/** How long after the slot start the player still hands out the video (missed-start grace). */
export const PLAYER_GRACE_HOURS = 6;

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export type WorkshopSlot = {
  /** The slot id — ISO timestamp with offset, exactly what the registration stores. */
  iso: string;
  epochMs: number;
};

/**
 * Upcoming slots for the picker: SLOT_LOCAL_HOURS × SLOT_WINDOW_DAYS in the given IANA timezone,
 * starting from the first slot at least one hour out (nobody books a session that starts as the
 * checkout loads). Runs client-side with the detected timezone; the server re-validates.
 */
export function upcomingSlots(nowMs: number, timeZone: string): WorkshopSlot[] {
  const out: WorkshopSlot[] = [];
  const minStartMs = nowMs + HOUR_MS;
  for (let day = 0; day < SLOT_WINDOW_DAYS + 1 && out.length < SLOT_WINDOW_DAYS * SLOT_LOCAL_HOURS.length; day++) {
    for (const hour of SLOT_LOCAL_HOURS) {
      const epochMs = zonedTimeToEpochMs(nowMs + day * DAY_MS, hour, timeZone);
      if (epochMs < minStartMs) continue;
      out.push({ iso: new Date(epochMs).toISOString(), epochMs });
    }
  }
  return out.slice(0, SLOT_WINDOW_DAYS * SLOT_LOCAL_HOURS.length);
}

/**
 * Resolve "the given local hour on the calendar day containing refMs, in timeZone" to epoch ms.
 * Uses Intl round-tripping (no date library — standing rule: no new deps for time math).
 */
function zonedTimeToEpochMs(refMs: number, localHour: number, timeZone: string): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(fmt.formatToParts(refMs).map((p) => [p.type, p.value]));
  // Guess: the target wall-clock time interpreted as UTC, then correct by the zone's offset at
  // the guess. Two passes converge across DST edges for whole-hour targets.
  let guess = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), localHour, 0, 0);
  for (let i = 0; i < 2; i++) {
    const seen = Object.fromEntries(fmt.formatToParts(guess).map((p) => [p.type, p.value]));
    const seenUtc = Date.UTC(
      Number(seen.year),
      Number(seen.month) - 1,
      Number(seen.day),
      Number(seen.hour),
      Number(seen.minute),
      0,
    );
    const targetUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), localHour, 0, 0);
    guess += targetUtc - seenUtc;
  }
  return guess;
}

/** Falls back to UTC when the client sends a timezone Intl doesn't know. */
export function safeTimeZone(tz: string): string {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

/** Server-side slot validation: parseable, in the future, inside the booking window. */
export function isValidSlot(slotIso: string, nowMs: number): boolean {
  const t = Date.parse(slotIso);
  if (!Number.isFinite(t)) return false;
  if (t <= nowMs) return false;
  return t <= nowMs + (SLOT_WINDOW_DAYS + 1) * DAY_MS;
}

export type LobbyPhase = "locked" | "open" | "live" | "ended";

/** Where the attendee stands relative to their slot. The lobby page renders from this. */
export function lobbyPhase(slotAtMs: number, nowMs: number): LobbyPhase {
  if (nowMs < slotAtMs - LOBBY_OPEN_MINUTES * MINUTE_MS) return "locked";
  if (nowMs < slotAtMs) return "open";
  if (nowMs <= slotAtMs + PLAYER_GRACE_HOURS * HOUR_MS) return "live";
  return "ended";
}

/** May the video-url route hand out a signed URL right now? */
export function canServeVideo(slotAtMs: number, nowMs: number): boolean {
  const phase = lobbyPhase(slotAtMs, nowMs);
  return phase === "live";
}
