// /api/app/apps/voice/calls/[id]/speak — the speak-as-Poc queue (PA-CHAN-16 outbound listen-in).
// The owner types a line; it lands as a speak_queue event the realtime bridge polls and delivers
// as Poc's next turn. Only live outbound calls accept lines — Poc doesn't ventriloquize inbound
// callers' conversations.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTier } from "@/lib/personas/tier-caps";
import { tierAllowsVoiceApp } from "@/lib/tiers/voice";
import { fetchVoiceCallById } from "@/lib/channels/voice/calls-store";
import { appendVoiceCallEvent } from "@/lib/channels/voice/realtime/events-store";
import { SpeakBodySchema } from "@/lib/channels/voice/realtime/views";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: { id: string } };

export async function POST(req: Request, { params }: RouteParams): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tier = await getCurrentTier(user.id);
  if (!tierAllowsVoiceApp(tier)) {
    return NextResponse.json({ error: "Voice is Studio+ and up." }, { status: 403 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = SpeakBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 422 });
  }

  const call = await fetchVoiceCallById(params.id, user.id);
  if (!call) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (call.direction !== "outbound") {
    return NextResponse.json({ error: "Lines can only be fed to outbound calls." }, { status: 409 });
  }
  if (call.status !== "ringing" && call.status !== "in_progress") {
    return NextResponse.json({ error: "That call already ended." }, { status: 409 });
  }

  const eventId = await appendVoiceCallEvent({
    callId: call.id,
    ownerId: user.id,
    eventType: "speak_queue",
    payload: { text: parsed.data.text, consumed: false },
  });
  if (eventId === null) {
    return NextResponse.json({ error: "Couldn't queue the line. Try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, eventId }, { status: 201 });
}
