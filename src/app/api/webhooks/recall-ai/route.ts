// POST /api/webhooks/recall-ai — Recall.ai (Svix) webhook receiver (Meeting Persona, MP-CORE-1).
//
// Flow:
//   1. Read the raw body + the Svix headers (svix-id / svix-timestamp / svix-signature).
//   2. Verify the signature over the Svix-assembled signed content (`${id}.${ts}.${body}`).
//   3. Record EVERY delivery to pa_meeting_persona_webhook_events regardless of verification (audit).
//      The UNIQUE(event_id) constraint makes this the idempotency gate — a re-delivery returns
//      firstDelivery=false and we skip reprocessing.
//   4. Only when the signature verified AND it's the first delivery do we mutate session state:
//        • bot.status_change → map the status code → update the session status
//        • recording.done    → populate recording_url
//        • transcript.done   → set transcript_available = true
//
// Unverified deliveries are audited (signature_verified=false) but NOT processed, and we return 200
// to avoid retry storms while the exact Svix scheme is reconciled against a live payload (see the
// TODO in lib/connectors/recall-ai/webhook.ts). Processing-only-on-verified is the security
// guarantee; the 200 is a retry-policy choice for the verification-pending window.

import { NextResponse } from "next/server";
import {
  extractRecordingUrl,
  mapRecallStatusToSessionStatus,
  parseRecallEvent,
  RECALL_EVENT,
  verifyRecallSignature,
} from "@/lib/connectors/recall-ai/webhook";
import {
  recordWebhookEvent,
  updateMeetingSessionByBotId,
} from "@/lib/connectors/recall-ai/db";
import { log } from "@/lib/connectors/recall-ai/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  const secret = process.env.RECALL_WEBHOOK_SECRET;
  if (!secret) {
    log.error("webhook: RECALL_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "server misconfigured" }, { status: 500 });
  }

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch (e) {
    log.error("webhook: failed to read body", { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");

  // Svix signs `${id}.${timestamp}.${body}`. When the headers are absent (non-Svix transport) we
  // fall back to signing the raw body alone.
  const signedContent =
    svixId && svixTimestamp ? `${svixId}.${svixTimestamp}.${rawBody}` : rawBody;
  const verified = verifyRecallSignature(signedContent, svixSignature, secret);

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch (e) {
    log.warn("webhook: non-JSON body", { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = parseRecallEvent(payload);
  const eventType = parsed?.eventType ?? "unknown";
  const botId = parsed?.botId ?? null;
  // The Svix message id is the idempotency key. Fall back to a body-derived id only if absent.
  const eventId = svixId ?? `nobody:${eventType}:${botId ?? "none"}`;

  const recorded = await recordWebhookEvent({
    eventId,
    recallBotId: botId,
    eventType,
    payload,
    signatureVerified: verified,
  });
  if (!recorded.ok) {
    log.error("webhook: audit insert failed", { event_id: eventId, status: recorded.status, error: recorded.error });
    return NextResponse.json({ error: "audit failed" }, { status: 500 });
  }

  // Idempotency: a re-delivery (same Svix id) was already audited + processed on the first delivery.
  if (!recorded.data.firstDelivery) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  if (!verified) {
    log.warn("webhook: signature not verified — audited, not processed", { event_id: eventId, event_type: eventType });
    return NextResponse.json({ received: true, processed: false });
  }

  if (!botId) {
    log.warn("webhook: verified event with no bot id — nothing to update", { event_id: eventId, event_type: eventType });
    return NextResponse.json({ received: true, processed: false });
  }

  try {
    if (eventType === RECALL_EVENT.BOT_STATUS_CHANGE) {
      const status = mapRecallStatusToSessionStatus(parsed?.statusCode ?? null);
      if (status) {
        const upd = await updateMeetingSessionByBotId(botId, { status });
        if (!upd.ok) log.error("webhook: session status update failed", { recall_bot_id: botId, status: upd.status, error: upd.error });
      } else {
        log.info("webhook: unmapped status code — session left unchanged", { recall_bot_id: botId, code: parsed?.statusCode ?? null });
      }
    } else if (eventType === RECALL_EVENT.RECORDING_DONE) {
      const url = extractRecordingUrl(payload);
      if (url) {
        const upd = await updateMeetingSessionByBotId(botId, { recording_url: url });
        if (!upd.ok) log.error("webhook: recording_url update failed", { recall_bot_id: botId, status: upd.status, error: upd.error });
      } else {
        log.warn("webhook: recording.done with no extractable URL", { recall_bot_id: botId });
      }
    } else if (eventType === RECALL_EVENT.TRANSCRIPT_DONE) {
      const upd = await updateMeetingSessionByBotId(botId, { transcript_available: true });
      if (!upd.ok) log.error("webhook: transcript_available update failed", { recall_bot_id: botId, status: upd.status, error: upd.error });
    } else {
      log.info("webhook: unhandled event type — audited only", { event_type: eventType, recall_bot_id: botId });
    }
  } catch (e) {
    log.error("webhook: handler threw", { event_id: eventId, event_type: eventType, error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ error: "handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true, processed: true });
}
