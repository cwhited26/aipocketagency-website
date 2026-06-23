// POST /api/webhooks/twilio-sms-capture/voice — the no-op voice fallback for Pocket Capture
// numbers. Twilio requires a VoiceUrl on a voice-capable number, but Pocket Capture never accepts
// calls. We answer 200 with an empty TwiML <Response/> so a stray inbound call is silently dropped
// (Twilio hangs up) rather than erroring. No signature check needed: there's no side effect and no
// data exposed — the response is a static empty document.

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function emptyTwiml(): NextResponse {
  return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
    status: 200,
    headers: { "content-type": "text/xml; charset=utf-8" },
  });
}

export async function POST(): Promise<NextResponse> {
  return emptyTwiml();
}

export async function GET(): Promise<NextResponse> {
  return emptyTwiml();
}
