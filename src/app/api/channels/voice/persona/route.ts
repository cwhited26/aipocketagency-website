// POST /api/channels/voice/persona — set which Persona answers voice calls + its voice profile.
//
// Body (JSON): { personaId, voiceId?, speakingStyle?, addressing?, greeting?, farewell?,
//                maxPersonaQuipsPerCall? }. Sets the connection's persona_id and merges the supplied
// fields into that Persona's voice_profile_json (the authoritative voice config the dispatcher reads).
// Auth required; the Persona must belong to the caller. Custom voice ids gate to Studio+.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { voiceCallEnabled } from "@/lib/channels/voice/feature-flag";
import { setChannelConnectionPersona } from "@/lib/channels/store";
import { fetchPersona, updatePersona } from "@/lib/personas/db";
import { parseVoiceProfile, serializeVoiceProfile, type VoiceProfile } from "@/lib/channels/voice/profile";
import { isCatalogVoiceId } from "@/lib/channels/voice/catalog";
import { getCurrentTier } from "@/lib/personas/tier-caps";
import { tierAllowsCustomVoiceId } from "@/lib/tiers/voice";
import { voiceLog } from "@/lib/channels/voice/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  personaId?: unknown;
  voiceId?: unknown;
  speakingStyle?: unknown;
  addressing?: unknown;
  greeting?: unknown;
  farewell?: unknown;
  maxPersonaQuipsPerCall?: unknown;
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

  const body = (await req.json().catch(() => ({}))) as Body;
  const personaId = str(body.personaId);
  if (!personaId) return NextResponse.json({ error: "personaId is required." }, { status: 400 });

  const persona = await fetchPersona(personaId);
  if (!persona || persona.business_id !== user.id) {
    return NextResponse.json({ error: "Persona not found." }, { status: 404 });
  }

  const tier = await getCurrentTier(user.id);
  const requestedVoice = str(body.voiceId);
  if (requestedVoice && !isCatalogVoiceId(requestedVoice) && !tierAllowsCustomVoiceId(tier)) {
    return NextResponse.json(
      { error: "Custom ElevenLabs voice ids are a Studio+ feature — pick one from the catalog." },
      { status: 403 },
    );
  }

  // Merge the supplied fields into the persona's existing profile (defaults fill the rest).
  const current = parseVoiceProfile(persona.voice_profile_json ?? null);
  const next: VoiceProfile = {
    ...current,
    elevenlabsVoiceId: requestedVoice ?? current.elevenlabsVoiceId,
    speakingStyle: str(body.speakingStyle) ?? current.speakingStyle,
    addressing: str(body.addressing) ?? current.addressing,
    greeting: str(body.greeting) ?? current.greeting,
    farewell: str(body.farewell) ?? current.farewell,
    maxPersonaQuipsPerCall:
      typeof body.maxPersonaQuipsPerCall === "number" && body.maxPersonaQuipsPerCall >= 0
        ? Math.floor(body.maxPersonaQuipsPerCall)
        : current.maxPersonaQuipsPerCall,
  };

  await updatePersona(personaId, { voice_profile_json: serializeVoiceProfile(next) });
  const setRes = await setChannelConnectionPersona(user.id, "voice", personaId);
  if (!setRes.ok) {
    return NextResponse.json({ error: "Couldn't set the persona." }, { status: setRes.status });
  }

  voiceLog.info("persona — voice persona + profile set", { ownerId: user.id, personaId });
  return NextResponse.json({ ok: true });
}
