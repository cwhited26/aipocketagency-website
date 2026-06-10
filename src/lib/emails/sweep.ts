// lib/emails/sweep.ts — the queue drain the */5 cron runs. Reads up to N due emails, renders each,
// sends via Resend, and records sent/failed with exponential backoff + an attempts cap. Marketing mail
// is skipped (cancelled) for unsubscribed recipients; transactional mail always sends.

import { sendEmail } from "@/lib/resend";
import { EMAIL_FROM } from "./render";
import { isTransactional, renderBySlug } from "./registry";
import {
  isUnsubscribed,
  listDueEmails,
  markEmailCancelled,
  markEmailFailure,
  markEmailSent,
  type EmailQueueRow,
} from "./queue";

export const MAX_ATTEMPTS = 5;
const BACKOFF_BASE_MINUTES = 5;
const BACKOFF_CAP_MINUTES = 6 * 60;

/** Exponential backoff for the next retry: 5, 10, 20, 40, 80 … minutes, capped. Pure, for tests. */
export function backoffSendAt(attempts: number, nowMs: number): string {
  const minutes = Math.min(BACKOFF_BASE_MINUTES * 2 ** Math.max(0, attempts - 1), BACKOFF_CAP_MINUTES);
  return new Date(nowMs + minutes * 60_000).toISOString();
}

export type SweepStats = { due: number; sent: number; failed: number; skipped: number };

export async function sweepEmailQueue(
  limit = 100,
  nowMs: number = Date.now(),
): Promise<{ ok: true; data: SweepStats } | { ok: false; error: string }> {
  const due = await listDueEmails(limit, new Date(nowMs).toISOString());
  if (!due.ok) return { ok: false, error: due.error };

  const stats: SweepStats = { due: due.data.length, sent: 0, failed: 0, skipped: 0 };

  for (const row of due.data) {
    const outcome = await processOne(row, nowMs);
    if (outcome === "sent") stats.sent += 1;
    else if (outcome === "failed") stats.failed += 1;
    else stats.skipped += 1;
  }

  return { ok: true, data: stats };
}

async function processOne(row: EmailQueueRow, nowMs: number): Promise<"sent" | "failed" | "skipped"> {
  // Marketing mail respects the unsubscribe list; transactional bypasses it.
  if (!isTransactional(row.template_slug)) {
    const unsub = await isUnsubscribed(row.email);
    if (unsub.ok && unsub.data) {
      await markEmailCancelled(row.id, "unsubscribed");
      return "skipped";
    }
  }

  const rendered = renderBySlug(row.template_slug, row.template_props);
  if (!rendered) {
    await markEmailFailure({
      id: row.id,
      attempts: MAX_ATTEMPTS, // unknown slug is permanent — go straight to failed
      errorText: `unknown template_slug: ${row.template_slug}`,
      maxAttempts: MAX_ATTEMPTS,
      nextSendAtIso: backoffSendAt(MAX_ATTEMPTS, nowMs),
    });
    return "failed";
  }

  let send: Awaited<ReturnType<typeof sendEmail>>;
  try {
    send = await sendEmail({
      from: EMAIL_FROM,
      to: row.email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
  } catch (e) {
    send = { ok: false, status: 502, error: e instanceof Error ? e.message : "send threw" };
  }

  if (send.ok) {
    await markEmailSent(row.id, new Date(nowMs).toISOString());
    return "sent";
  }

  const attempts = row.attempts + 1;
  await markEmailFailure({
    id: row.id,
    attempts,
    errorText: `${send.status}: ${send.error}`.slice(0, 1000),
    maxAttempts: MAX_ATTEMPTS,
    nextSendAtIso: backoffSendAt(attempts, nowMs),
  });
  return attempts >= MAX_ATTEMPTS ? "failed" : "skipped";
}
