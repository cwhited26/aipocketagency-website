// /api/channels/voice/stream — the Twilio Media Stream WebSocket endpoint (spec build-step 6).
//
// DEPLOYMENT NOTE (the spec's "if not, document this as a separate Vercel function or Edge runtime"):
// Twilio Media Streams require a persistent, bidirectional WebSocket. Vercel serverless / Fluid Compute
// functions cannot host one, and the `ws` package is not in this repo. So the real loop runs in a
// SEPARATE long-lived Node service that opens a `ws` server, adapts each Twilio connection to the
// VoiceSocket interface (src/lib/channels/voice/stream-loop.ts), and drives a VoiceCallSession with the
// shared, unit-tested pipeline (stt / tts / dispatcher-voice / tiers). The TwiML answer route points
// Twilio's <Stream url> at that service (env PA_VOICE_STREAM_WSS_URL), NOT at this route.
//
// This HTTP route exists so a misconfiguration (Twilio pointed here instead of the WS service) fails
// loudly with a diagnostic rather than silently dropping audio. See docs/voice-call/handoff.md for the
// standalone-service adapter snippet.

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIAGNOSTIC = {
  error: "websocket_upgrade_required",
  message:
    "The Voice Call Media Stream must connect to the standalone WebSocket service (PA_VOICE_STREAM_WSS_URL), " +
    "not this HTTP route. Vercel functions cannot host a persistent Twilio Media Stream socket. " +
    "See docs/voice-call/handoff.md for the standalone-service adapter.",
} as const;

export function GET(): NextResponse {
  // 426 Upgrade Required — this endpoint speaks HTTP; the Media Stream needs the WS service.
  return NextResponse.json(DIAGNOSTIC, { status: 426 });
}

export function POST(): NextResponse {
  return NextResponse.json(DIAGNOSTIC, { status: 426 });
}
