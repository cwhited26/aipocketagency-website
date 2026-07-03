// POST /api/channels/inbound/voice — the Voice v2 inbound webhook (PA-CHAN-15).
//
// Twilio calls this when a v2 voice DID rings. Signature first (PA-CHAN-4; a forged webhook gets a
// 401 and nothing else), then the abuse gates in order — is this DID one of ours, is the caller
// allowed, is the owner under the daily call cap — and only then TwiML that opens the Media Stream
// to the realtime bridge. Every decline is spoken TwiML (a caller hears Poc's line, not dead air)
// and ledgered as a completed pa_voice_calls row so the app surface shows what happened.

import { NextRequest, NextResponse } from "next/server";
import { voiceRealtimeEnabled } from "@/lib/channels/voice/feature-flag";
import { publicWebhookBase, twilioEnv, voiceRealtimeWsBase } from "@/lib/channels/voice/env";
import { isCallerAllowed, resolveVoiceOwnerByNumber } from "@/lib/channels/voice/connection";
import {
  buildConnectStreamTwiml,
  buildSayHangupTwiml,
  verifyTwilioSignature,
} from "@/lib/channels/voice/twilio";
import {
  classifyVoiceWebhook,
  decodeVoiceWebhookBody,
  VoiceWebhookSchema,
} from "@/lib/channels/adapters/voice/adapter";
import { upsertVoiceCall } from "@/lib/channels/voice/calls-store";
import {
  countVoiceCallsSince,
  updateVoiceCallV2Fields,
} from "@/lib/channels/voice/realtime/events-store";
import { DEFAULT_DAILY_CALL_CAP } from "@/lib/channels/voice/realtime/cost";
import { POC_CAP_FAREWELL, POC_DECLINE_UNKNOWN_CALLER } from "@/lib/channels/voice/realtime/prompt";
import { voiceLog } from "@/lib/channels/voice/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function xml(body: string, status = 200): NextResponse {
  return new NextResponse(body, { status, headers: { "Content-Type": "application/xml" } });
}

function startOfUtcDayIso(now: Date): string {
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return day.toISOString();
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const env = twilioEnv();
  if (!env) {
    voiceLog.error("inbound voice — Twilio env not configured");
    return xml(buildSayHangupTwiml("Voice is not configured. Goodbye."), 200);
  }

  const rawBody = await req.text();
  const params = decodeVoiceWebhookBody(rawBody);

  // Signature before anything else — the configured VoiceUrl is exactly this route, no query.
  const ok = verifyTwilioSignature({
    authToken: env.authToken,
    url: `${publicWebhookBase()}/api/channels/inbound/voice`,
    params,
    signature: req.headers.get("X-Twilio-Signature"),
  });
  if (!ok) {
    voiceLog.warn("inbound voice — bad Twilio signature");
    return new NextResponse("invalid signature", { status: 401 });
  }

  const parsed = VoiceWebhookSchema.safeParse(params);
  if (!parsed.success) {
    voiceLog.warn("inbound voice — malformed webhook body");
    return new NextResponse("malformed body", { status: 400 });
  }
  const classified = classifyVoiceWebhook(parsed.data);
  if (classified.kind === "ignore") {
    return xml('<?xml version="1.0" encoding="UTF-8"?><Response/>', 200);
  }

  if (!voiceRealtimeEnabled()) {
    return xml(buildSayHangupTwiml("Voice is not enabled yet. Goodbye."), 200);
  }

  // Which owner does this DID belong to?
  const resolved = await resolveVoiceOwnerByNumber(classified.to);
  if (!resolved) {
    voiceLog.warn("inbound voice — no connection for DID");
    return xml(buildSayHangupTwiml("This number isn't set up. Goodbye."), 200);
  }

  const recordDeclined = async (reason: string): Promise<void> => {
    await upsertVoiceCall({
      ownerId: resolved.ownerId,
      personaId: resolved.personaId,
      callSid: classified.callSid,
      fromNumber: classified.from,
      toNumber: classified.to,
      direction: "inbound",
      status: "completed",
    });
    await updateVoiceCallV2Fields({ callSid: classified.callSid, engine: "realtime_v2" });
    voiceLog.info("inbound voice — declined", { ownerId: resolved.ownerId, reason });
  };

  // Cold-inbound gate (PA-CHAN-15): unknown callers get the polite decline unless the owner
  // explicitly opted in. Voice cold-onboarding waits for the WhatsApp funnel's moderation proof.
  if (!isCallerAllowed(resolved.config, classified.from)) {
    await recordDeclined("unknown_caller");
    return xml(buildSayHangupTwiml(POC_DECLINE_UNKNOWN_CALLER), 200);
  }

  // Daily call cap (inbound + outbound share it).
  const cap = resolved.config.dailyCallCap ?? DEFAULT_DAILY_CALL_CAP;
  const usedToday = await countVoiceCallsSince(resolved.ownerId, startOfUtcDayIso(new Date()));
  if (usedToday >= cap) {
    await recordDeclined("daily_cap");
    return xml(buildSayHangupTwiml(POC_CAP_FAREWELL), 200);
  }

  await upsertVoiceCall({
    ownerId: resolved.ownerId,
    personaId: resolved.personaId,
    callSid: classified.callSid,
    fromNumber: classified.from,
    toNumber: classified.to,
    direction: "inbound",
    status: "in_progress",
  });
  await updateVoiceCallV2Fields({ callSid: classified.callSid, engine: "realtime_v2" });

  const streamUrl =
    `${voiceRealtimeWsBase()}?owner=${encodeURIComponent(resolved.ownerId)}` +
    `&callSid=${encodeURIComponent(classified.callSid)}&engine=realtime_v2`;
  voiceLog.info("inbound voice — opening realtime stream", {
    ownerId: resolved.ownerId,
    callSid: classified.callSid,
  });
  return xml(buildConnectStreamTwiml(streamUrl), 200);
}
