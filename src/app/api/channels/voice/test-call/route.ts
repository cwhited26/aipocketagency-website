// POST /api/channels/voice/test-call — place a test call to the owner's own number (spec §setup step 3
// test-call button). Outbound is otherwise deferred to v1.5 (spec §approval-gate 5); this is the one
// allowed outbound, and it is bounded to the owner's OWN registered number (config.callerNumber) so it
// can't be used to dial arbitrary destinations. The owner answers and talks to their agent to confirm
// the loop works before flipping the feature flag on.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { voiceCallEnabled } from "@/lib/channels/voice/feature-flag";
import { twilioEnv, publicWebhookBase } from "@/lib/channels/voice/env";
import { placeTestCall } from "@/lib/channels/voice/twilio";
import { getVoiceConnectionFull } from "@/lib/channels/voice/connection";
import { voiceLog } from "@/lib/channels/voice/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const connection = await getVoiceConnectionFull(user.id);
  if (!connection) {
    return NextResponse.json({ error: "Connect voice first." }, { status: 400 });
  }

  // Bound the destination to the owner's own registered number — never an arbitrary one.
  const to = connection.config.callerNumber;
  if (!to) {
    return NextResponse.json(
      { error: "Add the phone number you'll call from before testing." },
      { status: 400 },
    );
  }

  const twimlUrl = `${publicWebhookBase()}/api/channels/voice/twiml?owner=${encodeURIComponent(user.id)}`;
  const statusCallbackUrl = `${publicWebhookBase()}/api/channels/voice/status`;
  try {
    const { callSid } = await placeTestCall(
      { accountSid: env.accountSid, authToken: env.authToken },
      { to, from: connection.phoneNumber, twimlUrl, statusCallbackUrl },
    );
    voiceLog.info("test-call — placed", { ownerId: user.id, callSid });
    return NextResponse.json({ ok: true, callSid });
  } catch (err) {
    voiceLog.error("test-call — failed", {
      ownerId: user.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Couldn't place the test call." }, { status: 502 });
  }
}
