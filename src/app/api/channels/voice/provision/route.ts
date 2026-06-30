// POST /api/channels/voice/provision — provision the owner's voice number (spec §setup-flow step 3).
//
// Body (JSON): { pool: "own" | "shared", voiceId, personaId?, areaCode?, callerNumber? }.
//   • own    — provision a fresh Twilio DID (Workspace+/pro_plus+); webhook auto-pointed at our TwiML.
//   • shared — attach to the PA shared-pool number; callerNumber is the owner's phone (resolved on
//              inbound by caller ID, SMS-verified via the test-call flow).
// Auth required. Flag + tier gated. Returns { ok, phoneNumber } or an error.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { voiceCallEnabled } from "@/lib/channels/voice/feature-flag";
import { twilioEnv, publicWebhookBase } from "@/lib/channels/voice/env";
import { provisionNumber } from "@/lib/channels/voice/twilio";
import { saveVoiceConnection, type VoiceConnectionConfig } from "@/lib/channels/voice/connection";
import { isCatalogVoiceId, DEFAULT_VOICE_ID } from "@/lib/channels/voice/catalog";
import { getCurrentTier } from "@/lib/personas/tier-caps";
import {
  tierCanUseVoice,
  tierAllowsOwnVoiceNumber,
  tierAllowsCustomVoiceId,
} from "@/lib/tiers/voice";
import { voiceLog } from "@/lib/channels/voice/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  pool?: unknown;
  voiceId?: unknown;
  personaId?: unknown;
  areaCode?: unknown;
  callerNumber?: unknown;
};

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!voiceCallEnabled()) {
    return NextResponse.json({ error: "Voice Call isn't enabled." }, { status: 403 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const env = twilioEnv();
  if (!env) return NextResponse.json({ error: "Voice isn't configured." }, { status: 503 });

  const tier = await getCurrentTier(user.id);
  if (!tierCanUseVoice()) {
    return NextResponse.json({ error: "Voice isn't available on your plan." }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const pool = body.pool === "own" ? "own" : "shared";
  const personaId = str(body.personaId);
  const callerNumber = str(body.callerNumber);

  // Voice id: catalog ids are open to all; a custom id requires Studio+.
  const requestedVoice = str(body.voiceId) ?? DEFAULT_VOICE_ID;
  if (!isCatalogVoiceId(requestedVoice) && !tierAllowsCustomVoiceId(tier)) {
    return NextResponse.json(
      { error: "Custom ElevenLabs voice ids are a Studio+ feature — pick one from the catalog." },
      { status: 403 },
    );
  }

  if (pool === "own" && !tierAllowsOwnVoiceNumber(tier)) {
    return NextResponse.json(
      { error: "Your own number is a Workspace+ feature. Use the shared pool, or upgrade." },
      { status: 403 },
    );
  }

  const statusCallbackUrl = `${publicWebhookBase()}/api/channels/voice/status`;
  const config: VoiceConnectionConfig = {
    accountSid: env.accountSid,
    voiceId: requestedVoice,
    pool,
    numberSid: null,
    maxCallSeconds: null,
    callerNumber: pool === "shared" ? callerNumber : null,
  };

  let phoneNumber: string;
  if (pool === "own") {
    const voiceUrl = `${publicWebhookBase()}/api/channels/voice/twiml?owner=${encodeURIComponent(user.id)}`;
    try {
      const provisioned = await provisionNumber(
        { accountSid: env.accountSid, authToken: env.authToken },
        { voiceUrl, statusCallbackUrl, areaCode: str(body.areaCode) ?? undefined },
      );
      phoneNumber = provisioned.phoneNumber;
      config.numberSid = provisioned.sid;
    } catch (err) {
      voiceLog.error("provision — Twilio buy failed", {
        ownerId: user.id,
        error: err instanceof Error ? err.message : String(err),
      });
      return NextResponse.json({ error: "Couldn't provision a number — try again." }, { status: 502 });
    }
  } else {
    if (!env.sharedPoolNumber) {
      return NextResponse.json({ error: "The shared pool isn't available." }, { status: 503 });
    }
    if (!callerNumber) {
      return NextResponse.json(
        { error: "Enter the phone number you'll call from so we can route you on the shared line." },
        { status: 400 },
      );
    }
    phoneNumber = env.sharedPoolNumber;
  }

  const saved = await saveVoiceConnection({
    ownerId: user.id,
    phoneNumber,
    authToken: env.authToken,
    config,
    personaId,
  });
  if (!saved.ok) {
    return NextResponse.json({ error: "Couldn't save the connection." }, { status: saved.status });
  }

  voiceLog.info("provision — voice connected", { ownerId: user.id, pool });
  return NextResponse.json({ ok: true, phoneNumber });
}
