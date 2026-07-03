// /api/app/apps/voice/calls — the Voice App's call list (GET) and outbound-call creation (POST).
// Studio+ / Enterprise only (PA-CHAN-16; realtime audio is the most expensive surface PA runs).
//
// POST is the "Poc, call this number" door: E.164 + purpose in, tier gate, the shared daily call
// cap (inbound and outbound burn the same 10/day default), then one Twilio REST call whose TwiML
// URL is the realtime bridge answer route. The row is created BEFORE Twilio dials so the answer
// webhook can resolve it by CallSid; a Twilio failure marks it failed rather than orphaning it.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTier } from "@/lib/personas/tier-caps";
import { tierAllowsVoiceApp } from "@/lib/tiers/voice";
import { voiceRealtimeEnabled } from "@/lib/channels/voice/feature-flag";
import { publicWebhookBase, twilioEnv, twilioVoiceNumber } from "@/lib/channels/voice/env";
import { hangup, placeOutboundCall, TwilioError } from "@/lib/channels/voice/twilio";
import { listRecentVoiceCalls, upsertVoiceCall } from "@/lib/channels/voice/calls-store";
import {
  countVoiceCallsSince,
  updateVoiceCallV2Fields,
} from "@/lib/channels/voice/realtime/events-store";
import { DEFAULT_DAILY_CALL_CAP } from "@/lib/channels/voice/realtime/cost";
import { getVoiceConnection } from "@/lib/channels/voice/connection";
import { CreateCallBodySchema, toVoiceCallListView } from "@/lib/channels/voice/realtime/views";
import { voiceLog } from "@/lib/channels/voice/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIER_GATE_MESSAGE =
  "Voice is part of the Studio+ plan and up — Poc answering your phone runs on realtime audio, the most expensive thing we operate.";

function startOfUtcDayIso(now: Date): string {
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return day.toISOString();
}

export async function GET(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tier = await getCurrentTier(user.id);
  if (!tierAllowsVoiceApp(tier)) {
    return NextResponse.json({ error: TIER_GATE_MESSAGE }, { status: 403 });
  }

  const calls = await listRecentVoiceCalls(user.id, 50);
  return NextResponse.json({ calls: calls.map(toVoiceCallListView) });
}

export async function POST(req: Request): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tier = await getCurrentTier(user.id);
  if (!tierAllowsVoiceApp(tier)) {
    return NextResponse.json({ error: TIER_GATE_MESSAGE }, { status: 403 });
  }
  if (!voiceRealtimeEnabled()) {
    return NextResponse.json({ error: "Voice isn't switched on yet." }, { status: 503 });
  }
  const env = twilioEnv();
  const fromNumber = twilioVoiceNumber();
  if (!env || !fromNumber) {
    return NextResponse.json({ error: "Voice isn't configured yet." }, { status: 503 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = CreateCallBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 422 });
  }
  const body = parsed.data;

  // The shared daily cap — the same pool the inbound route draws from.
  const connection = await getVoiceConnection(user.id);
  const cap = connection.config?.dailyCallCap ?? DEFAULT_DAILY_CALL_CAP;
  const usedToday = await countVoiceCallsSince(user.id, startOfUtcDayIso(new Date()));
  if (usedToday >= cap) {
    return NextResponse.json(
      { error: `That's ${cap} calls today — the daily cap. It resets at midnight UTC.` },
      { status: 429 },
    );
  }

  const base = publicWebhookBase();
  let callSid: string;
  try {
    const placed = await placeOutboundCall(
      { accountSid: env.accountSid, authToken: env.authToken },
      {
        to: body.to,
        from: fromNumber,
        twimlUrl: `${base}/api/channels/voice/realtime-twiml`,
        statusCallbackUrl: `${base}/api/channels/voice/status`,
      },
    );
    callSid = placed.callSid;
  } catch (err) {
    if (err instanceof TwilioError) {
      voiceLog.error("outbound call create failed", { ownerId: user.id, status: err.status });
      return NextResponse.json(
        { error: "Twilio wouldn't place the call. Check the number and try again." },
        { status: 502 },
      );
    }
    throw err;
  }

  const rowId = await upsertVoiceCall({
    ownerId: user.id,
    personaId: connection.personaId,
    callSid,
    fromNumber,
    toNumber: body.to,
    direction: "outbound",
    status: "ringing",
  });
  await updateVoiceCallV2Fields({ callSid, engine: "realtime_v2", purpose: body.purpose });

  if (rowId === null) {
    // The call is dialing but the ledger write failed — end it rather than run an untracked call.
    voiceLog.error("outbound call row missing — hanging up", { callSid });
    try {
      await hangup({ accountSid: env.accountSid, authToken: env.authToken }, callSid);
    } catch (err) {
      if (!(err instanceof TwilioError)) throw err;
      voiceLog.error("untracked-call hangup failed", { callSid, status: err.status });
    }
    return NextResponse.json({ error: "Could not record the call, so it was ended." }, { status: 500 });
  }

  voiceLog.info("outbound call placed", { ownerId: user.id, callSid, callId: rowId });
  return NextResponse.json({ callId: rowId, callSid }, { status: 201 });
}
