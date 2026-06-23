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
import { lookupCaptureOwnerByTwilioNumber } from "@/lib/pocket-capture/sms-numbers";
import {
  claimSmsDelivery,
  markProcessed,
  markError,
  releaseSmsClaim,
} from "@/lib/pocket-capture/sms-log";
import { writeSmsCapture, isCarrierKeyword } from "@/lib/pocket-capture/sms-capture";

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

  // ── PC-CORE-5 (Reminders) seam ──────────────────────────────────────────────────────────────
  // A reminder-pattern message ("remind me to X in 39 min") is intercepted HERE — after owner
  // resolution + carrier-keyword filter, before the normal capture write below. Reminders should
  // claim the delivery (message_sid idempotency), schedule the outbound, mark the row processed
  // with a reminder note, and return twiml() WITHOUT calling writeSmsCapture. The parsed text is
  // sms.body; the reply path is connectors/sms/send.sendSms(config, { from: sms.to, to: sms.from }).

  // Claim the delivery. A duplicate redelivery collides on message_sid → acknowledge, don't recapture.
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

  await markProcessed(auditId);
  return twiml();
}
