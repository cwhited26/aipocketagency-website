// POST /api/webhooks/twilio-sms-capture — Pocket Capture's SMS surface (PC-CORE-3).
//
// Twilio delivers an inbound SMS/MMS for a per-owner dedicated number here as
// application/x-www-form-urlencoded. We verify the X-Twilio-Signature over the exact webhook URL +
// the sorted form params, resolve the `To` number to its owner, drop carrier keywords (STOP/HELP),
// re-upload any MMS media to Storage (Twilio's media URLs expire fast), and write the message to
// the owner's Capture Inbox (source="sms"). Every delivery is audited; the audit row's UNIQUE
// message_sid makes a duplicate Twilio redelivery a no-op.
//
// We answer 200 + empty TwiML for anything we can't (or shouldn't) process — unknown number, no
// brain connected, carrier keyword, duplicate — so Twilio doesn't retry a permanently-bad message.
// We answer non-2xx only for our own transient faults (auth token missing, brain commit blip) so a
// retry can recover.

import { NextResponse } from "next/server";
import { verifyCaptureSmsSignature } from "@/lib/connectors/twilio/signature";
import { parseInboundSms } from "@/lib/connectors/sms/inbound";
import { twilioConfig } from "@/lib/connectors/sms/config";
import { sendSms } from "@/lib/connectors/sms/send";
import { lookupCaptureOwnerByTwilioNumber } from "@/lib/pocket-capture/sms-numbers";
import {
  claimSmsDelivery,
  markProcessed,
  markProcessedWithNote,
  markError,
  releaseSmsClaim,
} from "@/lib/pocket-capture/sms-log";
import { writeSmsCapture, isCarrierKeyword } from "@/lib/pocket-capture/sms-capture";
import { parseReminderRequest, matchesReminderPattern, isUserFixable } from "@/lib/pocket-capture/reminders/parse";
import { insertReminder, fetchOwnerAnthropicKey } from "@/lib/pocket-capture/reminders/db";
import { confirmationMessage, reminderErrorMessage } from "@/lib/pocket-capture/reminders/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Twilio acknowledges the webhook with TwiML. Empty <Response/> = "do nothing" (no auto-reply).
function twiml(): NextResponse {
  return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
    status: 200,
    headers: { "content-type": "text/xml; charset=utf-8" },
  });
}

export async function POST(req: Request): Promise<NextResponse> {
  const rawBody = await req.text();
  const params = Object.fromEntries(new URLSearchParams(rawBody));

  // Verify the signature over the exact (URL, params) BEFORE doing anything else.
  const verified = verifyCaptureSmsSignature(params, req.headers.get("x-twilio-signature"));
  if (!verified.ok) {
    if (verified.reason === "not-configured") {
      // Misconfiguration, not a client error — fail closed so unsigned texts are never processed.
      return NextResponse.json({ error: "twilio not configured" }, { status: 500 });
    }
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  const sms = parseInboundSms(params);
  if (!sms) {
    // Missing From / To / MessageSid — not a routable message. Acknowledge so Twilio stops.
    return twiml();
  }

  const mediaUrls = sms.media.map((m) => m.url);

  // Resolve the texted number to its owner.
  const ownerResult = await lookupCaptureOwnerByTwilioNumber(sms.to);
  if (!ownerResult.ok) {
    return NextResponse.json({ error: ownerResult.error }, { status: ownerResult.status });
  }

  // Unknown number — audit the attempt (no owner) and acknowledge so Twilio stops retrying.
  if (!ownerResult.data) {
    const claim = await claimSmsDelivery({
      ownerId: null,
      fromNumber: sms.from,
      toNumber: sms.to,
      messageSid: sms.messageSid,
      messageBody: sms.body || null,
      mediaUrls,
      processed: false,
      errorText: `unknown capture number: ${sms.to}`,
    });
    if (!claim.ok) return NextResponse.json({ error: claim.error }, { status: claim.status });
    return twiml();
  }
  const owner = ownerResult.data;

  // Carrier keyword (STOP / HELP / …) — Twilio handles the opt-out itself; we audit + never capture.
  if (isCarrierKeyword(sms.body)) {
    const claim = await claimSmsDelivery({
      ownerId: owner.id,
      fromNumber: sms.from,
      toNumber: sms.to,
      messageSid: sms.messageSid,
      messageBody: sms.body || null,
      mediaUrls,
      processed: false,
      errorText: `carrier keyword: ${sms.body.trim().toUpperCase()}`,
    });
    if (!claim.ok) return NextResponse.json({ error: claim.error }, { status: claim.status });
    return twiml();
  }

  // Claim the delivery. A duplicate redelivery collides on message_sid → acknowledge, don't reprocess.
  // The claim happens once here (after owner resolution + carrier-keyword filter) and guards BOTH the
  // reminder and the capture paths below, so a Twilio retry can never double-schedule or double-capture.
  const claim = await claimSmsDelivery({
    ownerId: owner.id,
    fromNumber: sms.from,
    toNumber: sms.to,
    messageSid: sms.messageSid,
    messageBody: sms.body || null,
    mediaUrls,
  });
  if (!claim.ok) return NextResponse.json({ error: claim.error }, { status: claim.status });
  if (claim.duplicate) return twiml();
  const auditId = claim.id;

  // ── PC-CORE-5 (Reminders) ─────────────────────────────────────────────────────────────────────
  // A reminder-shaped text ("remind me to X in 39 min") is scheduled here instead of captured as a
  // note. The regex gate keeps the Haiku spend off ordinary captures. A confident reminder schedules
  // + confirms and returns. A reminder with an unusable time nudges the owner to rephrase, then falls
  // through to capture (so the thought is never lost). Anything else (not a reminder, or an infra
  // failure like no API key) just captures. The note on the audit row records which path was taken.
  let captureNote: string | null = null;
  if (matchesReminderPattern(sms.body)) {
    const apiKey = await fetchOwnerAnthropicKey(owner.id);
    const now = new Date();
    const parsed = await parseReminderRequest({
      text: sms.body,
      now,
      apiKey,
      cost: {
        ownerId: owner.id,
        featureSlug: "pocket_capture_reminders",
        idempotencyKey: `reminder-parse:${sms.messageSid}`,
      },
    });

    if (parsed.isReminder && parsed.ok) {
      const inserted = await insertReminder({
        ownerId: owner.id,
        originalCaptureId: auditId,
        taskText: parsed.taskText,
        remindAt: parsed.remindAt,
        sourceText: sms.body,
        deliverTo: sms.from,
        deliverFrom: sms.to,
      });
      if (!inserted.ok) {
        // Couldn't persist the schedule — release the claim so a Twilio retry can reschedule.
        await releaseSmsClaim(auditId);
        return NextResponse.json({ error: inserted.error }, { status: 502 });
      }
      const config = twilioConfig();
      if (config) {
        await sendSms(config, {
          from: sms.to,
          to: sms.from,
          body: confirmationMessage(parsed.taskText, parsed.remindAt, now),
        });
      }
      await markProcessedWithNote(auditId, `reminder_set:${inserted.data.id}`);
      return twiml();
    }

    if (parsed.isReminder && !parsed.ok && isUserFixable(parsed.reason)) {
      // Reminder intent, unusable time — tell the owner how to fix it, then save the text as a note.
      const config = twilioConfig();
      if (config) {
        await sendSms(config, { from: sms.to, to: sms.from, body: reminderErrorMessage(parsed.reason) });
      }
      captureNote = `reminder_failed:${parsed.reason}`;
    } else if (parsed.isReminder && !parsed.ok) {
      // Infra failure (no key / API error) — capture silently, but record why on the audit row.
      captureNote = `reminder_skipped:${parsed.reason}`;
    }
  }

  // Normal capture (also the reminder fall-through path).
  const result = await writeSmsCapture({ owner, sms, captureId: auditId });

  if (!result.ok) {
    if (result.reason === "no-brain") {
      // Persistent until the owner connects a brain — record it and stop retrying.
      await markError(auditId, result.error);
      return twiml();
    }
    // Transient (e.g. a GitHub commit blip) — release the claim so a Twilio retry reprocesses.
    await releaseSmsClaim(auditId);
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  if (captureNote) await markProcessedWithNote(auditId, captureNote);
  else await markProcessed(auditId);
  return twiml();
}
