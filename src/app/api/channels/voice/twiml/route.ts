// POST /api/channels/voice/twiml?owner=<id> — the Twilio Voice answer webhook (spec build-step 5).
//
// Twilio calls this when the owner's number rings. We verify the X-Twilio-Signature first (PA-CHAN-4,
// never trust an unsigned webhook), record the call as in_progress, and return TwiML that opens a
// bidirectional Media Stream to the standalone WS service (which runs the STT→dispatcher→TTS loop).
// On the cap being already exhausted, or any error, we return a spoken-hangup TwiML instead.

import { NextRequest, NextResponse } from "next/server";
import { voiceCallEnabled } from "@/lib/channels/voice/feature-flag";
import { twilioEnv, publicWebhookBase, voiceStreamWsBase } from "@/lib/channels/voice/env";
import {
  getVoiceConnectionFull,
  resolveSharedVoiceOwnerByCaller,
} from "@/lib/channels/voice/connection";
import {
  buildConnectStreamTwiml,
  buildSayHangupTwiml,
  verifyTwilioSignature,
} from "@/lib/channels/voice/twilio";
import { upsertVoiceCall } from "@/lib/channels/voice/calls-store";
import { getCurrentTier } from "@/lib/personas/tier-caps";
import { resolveVoiceCeiling } from "@/lib/channels/voice/usage";
import { CAP_HANGUP_REPLY } from "@/lib/channels/voice/profile";
import { voiceLog } from "@/lib/channels/voice/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TWIML = "application/xml";

function xml(body: string, status = 200): NextResponse {
  return new NextResponse(body, { status, headers: { "Content-Type": TWIML } });
}

function formToRecord(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(raw)) out[k] = v;
  return out;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!voiceCallEnabled()) {
    return xml(buildSayHangupTwiml("Voice is not enabled yet. Goodbye."), 200);
  }

  const env = twilioEnv();
  if (!env) {
    voiceLog.error("twiml — Twilio env not configured");
    return xml(buildSayHangupTwiml("Voice is not configured. Goodbye."), 200);
  }

  const rawBody = await req.text();
  const params = formToRecord(rawBody);

  // Resolve the owner: own-number calls carry ?owner=; a shared-pool DID has no owner in the URL, so
  // resolve by the caller's number against the shared-pool connections (config.caller_number).
  const ownerParam = req.nextUrl.searchParams.get("owner");
  const from = params.From ?? "";
  let owner = ownerParam;
  let connection: {
    authToken: string | null;
    personaId: string | null;
    config: { maxCallSeconds: number | null };
  } | null = null;

  if (owner) {
    connection = await getVoiceConnectionFull(owner);
  } else if (from) {
    const resolved = await resolveSharedVoiceOwnerByCaller(from);
    if (resolved) {
      owner = resolved.ownerId;
      connection = resolved;
    }
  }
  if (!owner) {
    voiceLog.warn("twiml — could not resolve owner", { hasOwnerParam: Boolean(ownerParam) });
    return xml(buildSayHangupTwiml("This number isn't set up. Goodbye."), 200);
  }

  // Signature: verify against the owner connection's decrypted Twilio token (== PA's account token),
  // falling back to the env token. The signed URL is exactly the configured VoiceUrl: own-number
  // includes ?owner=; the shared pool's configured VoiceUrl has no query.
  const authToken = connection?.authToken ?? env.authToken;
  const signedUrl = ownerParam
    ? `${publicWebhookBase()}/api/channels/voice/twiml?owner=${encodeURIComponent(ownerParam)}`
    : `${publicWebhookBase()}/api/channels/voice/twiml`;
  const ok = verifyTwilioSignature({
    authToken,
    url: signedUrl,
    params,
    signature: req.headers.get("X-Twilio-Signature"),
  });
  if (!ok) {
    voiceLog.warn("twiml — bad Twilio signature", { owner });
    return xml(buildSayHangupTwiml("Goodbye."), 403);
  }

  const callSid = params.CallSid ?? "";
  const to = params.To ?? "";
  if (!callSid) {
    return xml(buildSayHangupTwiml("Goodbye."), 200);
  }

  // Cap check on answer: if the owner's monthly/daily ceiling is already exhausted, hang up with the
  // spoken cap message instead of opening a (billable) stream.
  const tier = await getCurrentTier(owner);
  const ceiling = await resolveVoiceCeiling({
    ownerId: owner,
    tier,
    perCallMaxSeconds: connection?.config.maxCallSeconds ?? null,
    now: new Date(),
  });
  if (ceiling.allowedSeconds <= 0) {
    voiceLog.info("twiml — cap exhausted on answer", { owner, limitedBy: ceiling.limitedBy });
    await upsertVoiceCall({
      ownerId: owner,
      personaId: connection?.personaId ?? null,
      callSid,
      fromNumber: from,
      toNumber: to,
      direction: "inbound",
      status: "completed",
    });
    return xml(buildSayHangupTwiml(CAP_HANGUP_REPLY), 200);
  }

  await upsertVoiceCall({
    ownerId: owner,
    personaId: connection?.personaId ?? null,
    callSid,
    fromNumber: from,
    toNumber: to,
    direction: "inbound",
    status: "in_progress",
  });

  // Open the Media Stream to the WS service, passing owner + callSid so it can resolve the connection
  // and finalize the call. The service enforces the same ceiling per-frame as the answer check.
  const streamUrl =
    `${voiceStreamWsBase()}?owner=${encodeURIComponent(owner)}&callSid=${encodeURIComponent(callSid)}`;
  voiceLog.info("twiml — opening media stream", { owner, callSid, ceiling: ceiling.allowedSeconds });
  return xml(buildConnectStreamTwiml(streamUrl), 200);
}
