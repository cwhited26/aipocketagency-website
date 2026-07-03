// /api/app/apps/voice/calls/[id] — one call: detail with live event stream (GET, ~2s poll from
// the detail page while the call is live) and hang-up (DELETE). Owner-scoped by the row lookup.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTier } from "@/lib/personas/tier-caps";
import { tierAllowsVoiceApp } from "@/lib/tiers/voice";
import { twilioEnv } from "@/lib/channels/voice/env";
import { hangup, TwilioError } from "@/lib/channels/voice/twilio";
import { fetchVoiceCallById, finalizeVoiceCall } from "@/lib/channels/voice/calls-store";
import { listVoiceCallEvents } from "@/lib/channels/voice/realtime/events-store";
import { toVoiceCallDetailView } from "@/lib/channels/voice/realtime/views";
import { voiceLog } from "@/lib/channels/voice/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: { id: string } };

export async function GET(_req: Request, { params }: RouteParams): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tier = await getCurrentTier(user.id);
  if (!tierAllowsVoiceApp(tier)) {
    return NextResponse.json({ error: "Voice is Studio+ and up." }, { status: 403 });
  }

  const call = await fetchVoiceCallById(params.id, user.id);
  if (!call) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const events = await listVoiceCallEvents({ callId: call.id, ownerId: user.id });
  return NextResponse.json({ call: toVoiceCallDetailView(call, events) });
}

export async function DELETE(_req: Request, { params }: RouteParams): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const call = await fetchVoiceCallById(params.id, user.id);
  if (!call) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (call.status !== "ringing" && call.status !== "in_progress") {
    return NextResponse.json({ error: "That call already ended." }, { status: 409 });
  }

  const env = twilioEnv();
  if (!env) return NextResponse.json({ error: "Voice isn't configured yet." }, { status: 503 });

  try {
    await hangup({ accountSid: env.accountSid, authToken: env.authToken }, call.twilio_call_sid);
  } catch (err) {
    if (!(err instanceof TwilioError)) throw err;
    voiceLog.error("owner hangup failed", { callId: call.id, status: err.status });
    return NextResponse.json({ error: "Twilio wouldn't end the call. Try again." }, { status: 502 });
  }

  // The status callback finalizes duration + cost; reflect the owner's intent immediately so the
  // UI doesn't show a live call for the callback round-trip.
  await finalizeVoiceCall({ callSid: call.twilio_call_sid, status: "completed", hangupReason: "owner_hangup" });
  voiceLog.info("owner hung up call", { callId: call.id });
  return NextResponse.json({ ok: true });
}
