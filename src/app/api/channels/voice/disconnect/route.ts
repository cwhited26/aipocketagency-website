// POST /api/channels/voice/disconnect — remove the owner's voice connection (deletes the row).
// Does NOT release the Twilio number (release is a deliberate, separate operator step) — disconnecting
// just stops PA answering. Auth required.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { voiceCallEnabled } from "@/lib/channels/voice/feature-flag";
import { removeVoiceConnection } from "@/lib/channels/voice/connection";
import { voiceLog } from "@/lib/channels/voice/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse> {
  if (!voiceCallEnabled()) {
    return NextResponse.json({ error: "Voice Call isn't enabled." }, { status: 403 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const ok = await removeVoiceConnection(user.id);
  if (!ok) return NextResponse.json({ error: "Couldn't disconnect." }, { status: 500 });
  voiceLog.info("disconnect — voice removed", { ownerId: user.id });
  return NextResponse.json({ ok: true });
}
