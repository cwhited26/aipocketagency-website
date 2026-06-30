// POST /api/channels/voice/status — Twilio call status callback (spec build-step + §cost-logging).
//
// Twilio POSTs here as the call progresses and on completion (CallStatus, CallDuration). We verify the
// signature, map Twilio's status to ours, finalize the pa_voice_calls row (duration + cost), and write
// the per-call summary cost event. The per-segment whisper/tts seconds are known precisely only inside
// the WS stream service; this callback is the fallback that prices from the billed call duration (an
// estimate — the per-turn anthropic rows remain the authoritative LLM ledger).

import { NextRequest, NextResponse } from "next/server";
import { voiceCallEnabled } from "@/lib/channels/voice/feature-flag";
import { twilioEnv, publicWebhookBase } from "@/lib/channels/voice/env";
import { verifyTwilioSignature } from "@/lib/channels/voice/twilio";
import {
  fetchVoiceCallBySid,
  finalizeVoiceCall,
  type VoiceCallStatus,
} from "@/lib/channels/voice/calls-store";
import { getVoiceConnectionFull } from "@/lib/channels/voice/connection";
import { computeCallCostBreakdown, logVoiceCallSummaryCost } from "@/lib/channels/voice/cost";
import { voiceLog } from "@/lib/channels/voice/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function formToRecord(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(raw)) out[k] = v;
  return out;
}

// Map Twilio's CallStatus to our pa_voice_calls.status CHECK set.
function mapStatus(twilioStatus: string): VoiceCallStatus {
  switch (twilioStatus) {
    case "completed":
      return "completed";
    case "no-answer":
      return "no_answer";
    case "ringing":
      return "ringing";
    case "in-progress":
      return "in_progress";
    default:
      // busy | failed | canceled
      return "failed";
  }
}

const TERMINAL: ReadonlySet<string> = new Set(["completed", "busy", "failed", "no-answer", "canceled"]);

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!voiceCallEnabled()) return NextResponse.json({ ok: true });

  const env = twilioEnv();
  if (!env) return NextResponse.json({ ok: true });

  const rawBody = await req.text();
  const params = formToRecord(rawBody);
  const callSid = params.CallSid ?? "";
  if (!callSid) return NextResponse.json({ ok: true });

  // Resolve the owner from the call row (created on answer) to get the right auth token for verify.
  const existing = await fetchVoiceCallBySid(callSid);
  const ownerId = existing?.owner_id ?? null;
  const connection = ownerId ? await getVoiceConnectionFull(ownerId) : null;
  const authToken = connection?.authToken ?? env.authToken;

  const ok = verifyTwilioSignature({
    authToken,
    url: `${publicWebhookBase()}/api/channels/voice/status`,
    params,
    signature: req.headers.get("X-Twilio-Signature"),
  });
  if (!ok) {
    voiceLog.warn("status — bad Twilio signature", { callSid });
    return NextResponse.json({ error: "bad signature" }, { status: 403 });
  }

  const twilioStatus = params.CallStatus ?? "";
  const status = mapStatus(twilioStatus);
  if (!TERMINAL.has(twilioStatus)) {
    // Non-terminal progress event — just reflect the status.
    await finalizeVoiceCall({ callSid, status });
    return NextResponse.json({ ok: true });
  }

  const durationSeconds = Number.parseInt(params.CallDuration ?? "0", 10) || 0;

  let costCents: number | null = null;
  if (ownerId && durationSeconds > 0) {
    // Fallback pricing from the billed call duration: split caller/agent audio ~50/50 for the whisper
    // + TTS segment estimate (the WS service can finalize with exact per-segment seconds when wired).
    const breakdown = computeCallCostBreakdown({
      callSeconds: durationSeconds,
      whisperAudioSeconds: durationSeconds * 0.5,
      ttsAudioSeconds: durationSeconds * 0.5,
    });
    costCents = await logVoiceCallSummaryCost({ ownerId, callSid, breakdown });
  }

  await finalizeVoiceCall({
    callSid,
    status,
    endedAt: new Date().toISOString(),
    durationSeconds: durationSeconds > 0 ? durationSeconds : null,
    costCents,
    hangupReason: twilioStatus,
  });

  voiceLog.info("status — call finalized", { callSid, status, durationSeconds, costCents });
  return NextResponse.json({ ok: true });
}
