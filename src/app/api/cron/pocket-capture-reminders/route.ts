// GET /api/cron/pocket-capture-reminders  (Vercel Cron, every minute)
//
// PC-CORE-5 reminder delivery. Sweeps the pending reminders whose remind_at has arrived and texts
// the owner from their dedicated Twilio number. A row carries its own deliver_to / deliver_from so
// the sweep is a single-table read. Delivery is at-least-once: we send THEN mark delivered, so a
// crash between the two re-sends next minute rather than dropping the reminder (the every-minute cron
// doesn't overlap itself in practice, so a duplicate is a non-issue). A failed send bumps retry_count
// and keeps the row pending; at MAX_RETRIES the row is parked 'failed' and no longer swept.

import { NextResponse } from "next/server";
import { twilioConfig } from "@/lib/connectors/sms/config";
import { sendSms } from "@/lib/connectors/sms/send";
import {
  listDueReminders,
  markReminderDelivered,
  bumpReminderRetry,
  markReminderFailed,
  MAX_RETRIES,
} from "@/lib/pocket-capture/reminders/db";
import { reminderMessage } from "@/lib/pocket-capture/reminders/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cap per sweep so a backlog can't run the function past its budget; the next minute picks up the rest.
const SWEEP_LIMIT = 100;

export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = twilioConfig();
  if (!config) {
    // Twilio not configured — nothing we can send. Leave rows pending for when it is. Not an error.
    return NextResponse.json({ ok: true, skipped: "twilio_not_configured", delivered: 0 });
  }

  const now = new Date();
  const due = await listDueReminders(now.toISOString(), SWEEP_LIMIT);
  if (!due.ok) return NextResponse.json({ ok: false, error: due.error }, { status: due.status });

  let delivered = 0;
  let retried = 0;
  let failed = 0;

  for (const reminder of due.data) {
    const body = reminderMessage(reminder.task_text, new Date(reminder.created_at), now);
    const send = await sendSms(config, {
      from: reminder.deliver_from,
      to: reminder.deliver_to,
      body,
    });

    if (send.ok) {
      await markReminderDelivered(reminder.id, new Date().toISOString());
      delivered++;
      continue;
    }

    const nextCount = reminder.retry_count + 1;
    if (nextCount >= MAX_RETRIES) {
      await markReminderFailed(reminder.id, send.error, nextCount);
      failed++;
    } else {
      await bumpReminderRetry(reminder.id, send.error, nextCount);
      retried++;
    }
  }

  return NextResponse.json({ ok: true, due: due.data.length, delivered, retried, failed });
}
