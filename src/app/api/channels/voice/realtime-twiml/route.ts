// POST /api/channels/voice/realtime-twiml — the outbound-call answer webhook (PA-CHAN-16).
//
// When a Voice v2 OUTBOUND call connects (the callee picked up), Twilio fetches this URL for
// instructions. We verify the signature, confirm the CallSid maps to a call row the app API
// created (an attacker who reaches this route with a signed-but-foreign CallSid gets a hangup),
// and open the Media Stream to the realtime bridge — same transport as inbound, different opener
// (Poc introduces itself and states the owner's purpose).

import { NextRequest, NextResponse } from "next/server";
import { voiceRealtimeEnabled } from "@/lib/channels/voice/feature-flag";
import { publicWebhookBase, twilioEnv, voiceRealtimeWsBase } from "@/lib/channels/voice/env";
import {
  buildConnectStreamTwiml,
  buildSayHangupTwiml,
  verifyTwilioSignature,
} from "@/lib/channels/voice/twilio";
import { fetchVoiceCallBySid, finalizeVoiceCall } from "@/lib/channels/voice/calls-store";
import { voiceLog } from "@/lib/channels/voice/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function xml(body: string, status = 200): NextResponse {
  return new NextResponse(body, { status, headers: { "Content-Type": "application/xml" } });
}

function formToRecord(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(raw)) out[k] = v;
  return out;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!voiceRealtimeEnabled()) {
    return xml(buildSayHangupTwiml("Voice is not enabled yet. Goodbye."), 200);
  }
  const env = twilioEnv();
  if (!env) {
    voiceLog.error("realtime-twiml — Twilio env not configured");
    return xml(buildSayHangupTwiml("Voice is not configured. Goodbye."), 200);
  }

  const rawBody = await req.text();
  const params = formToRecord(rawBody);

  const ok = verifyTwilioSignature({
    authToken: env.authToken,
    url: `${publicWebhookBase()}/api/channels/voice/realtime-twiml`,
    params,
    signature: req.headers.get("X-Twilio-Signature"),
  });
  if (!ok) {
    voiceLog.warn("realtime-twiml — bad Twilio signature");
    return new NextResponse("invalid signature", { status: 401 });
  }

  const callSid = params.CallSid ?? "";
  const call = callSid ? await fetchVoiceCallBySid(callSid) : null;
  if (!call || call.direction !== "outbound" || call.engine !== "realtime_v2") {
    voiceLog.warn("realtime-twiml — no matching outbound realtime call", { callSid });
    return xml(buildSayHangupTwiml("Goodbye."), 200);
  }

  await finalizeVoiceCall({ callSid, status: "in_progress" });

  const streamUrl =
    `${voiceRealtimeWsBase()}?owner=${encodeURIComponent(call.owner_id)}` +
    `&callSid=${encodeURIComponent(callSid)}&engine=realtime_v2&direction=outbound`;
  voiceLog.info("realtime-twiml — outbound call connected", { callSid, ownerId: call.owner_id });
  return xml(buildConnectStreamTwiml(streamUrl), 200);
}
