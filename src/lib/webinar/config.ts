// lib/webinar/config.ts — the single source of truth for the live-webinar schedule + replay URL
// (GTM Phase 5A). No dates are hardcoded: the next-session timestamp and the replay/join URLs come
// from env, with sane fallbacks so the funnel still works (and the email schedule still computes)
// before Chase sets them. Server-only reads of process.env — every caller runs server-side
// (page render, cron, API route).

import { SITE_ORIGIN } from "@/lib/emails/render";

export const WEBINAR_TITLE = "Build Your AI Team Without Becoming An AI Expert";
export const WEBINAR_DURATION_MINUTES = 60;

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The configured next live-session timestamp (ISO `WEBINAR_NEXT_SESSION_AT`). Returns null when the
 * env is unset or unparseable — pages render a "date to be announced" state in that case.
 */
export function nextWebinarAt(): Date | null {
  const raw = process.env.WEBINAR_NEXT_SESSION_AT?.trim();
  if (!raw) return null;
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) return null;
  return new Date(ms);
}

/**
 * The webinar timestamp the email scheduler anchors offsets to. Uses the configured session when
 * present; otherwise rolls a default 7 days out from `nowMs` so the sequence never enqueues against a
 * missing date. This is a rolling fallback, NOT a fixed calendar date (the no-hardcoded-dates rule).
 */
export function resolveWebinarAtMs(nowMs: number = Date.now()): number {
  const configured = nextWebinarAt();
  if (configured) return configured.getTime();
  return nowMs + SEVEN_DAYS_MS;
}

/** The replay video URL (`WEBINAR_REPLAY_URL`). Falls back to the marketing replay page. */
export function webinarReplayUrl(): string {
  return process.env.WEBINAR_REPLAY_URL?.trim() || `${SITE_ORIGIN}/replay`;
}

/** The live-room join URL (`WEBINAR_JOIN_URL`). Falls back to the replay page until a room is set. */
export function webinarJoinUrl(): string {
  return process.env.WEBINAR_JOIN_URL?.trim() || `${SITE_ORIGIN}/replay`;
}

/** A human-readable session label for page copy + emails, e.g. "Tuesday, June 17 · 11:00 AM CT". */
export function webinarWhenLabel(at: Date | null): string {
  if (!at) return "Date to be announced — watch your email";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone: "America/Chicago",
  }).format(at);
}
