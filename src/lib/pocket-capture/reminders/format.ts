// format.ts — the SMS copy for the reminders surface. All pure → unit-tested.
//
// Three customer-facing strings:
//   confirmationMessage  — sent right after a reminder is scheduled (PC-Q10: confirm so the owner
//                          knows the parse worked).
//   reminderMessage      — sent by the cron when the reminder is due.
//   reminderErrorMessage — sent when the text looked like a reminder but the time was unusable, so
//                          the owner knows to rephrase (the thought is still captured as a note).
//
// Times are formatted in UTC: Pocket Capture has no per-owner timezone in v1 (PC-CORE-5 parses
// against UTC), so rendering anything else would be a lie. When a tz column lands, thread it through.

import type { ReminderParseFailure } from "./parse";

/**
 * A short human duration from a millisecond span: "39 min", "2 hours", "3 days". Rounds to the
 * largest sensible unit; clamps negatives to "0 min" so a just-past span never reads "-1 min".
 */
export function humanizeDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60_000));
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const totalHours = Math.round(totalMinutes / 60);
  if (totalHours < 24) return `${totalHours} ${totalHours === 1 ? "hour" : "hours"}`;
  const days = Math.round(totalHours / 24);
  return `${days} ${days === 1 ? "day" : "days"}`;
}

/** An absolute time rendered in UTC, e.g. "Tue, Jun 24, 9:00 AM UTC". Deterministic for tests. */
export function formatAbsoluteUtc(when: Date): string {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(when);
  return `${formatted} UTC`;
}

/** PC-Q10 confirmation: "Got it. Reminding you to call the dentist at <when> (in 39 min)." */
export function confirmationMessage(taskText: string, remindAt: Date, now: Date): string {
  const inLabel = humanizeDuration(remindAt.getTime() - now.getTime());
  return `Got it. Reminding you to ${taskText} at ${formatAbsoluteUtc(remindAt)} (in ${inLabel}).`;
}

/** The due reminder: "Reminder: call the dentist (you set this 39 min ago)." */
export function reminderMessage(taskText: string, createdAt: Date, now: Date): string {
  const agoLabel = humanizeDuration(now.getTime() - createdAt.getTime());
  return `Reminder: ${taskText} (you set this ${agoLabel} ago).`;
}

/** Tell the owner why a reminder didn't schedule, and that the text was saved as a note instead. */
export function reminderErrorMessage(reason: ReminderParseFailure): string {
  const lead =
    reason === "horizon-exceeded"
      ? "That reminder is more than 90 days out — I can only schedule up to 90 days."
      : "I couldn't tell when to remind you.";
  return `${lead} I saved it as a note instead. Try something like "remind me to call the dentist in 30 min".`;
}
