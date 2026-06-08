// /api/connectors/sms/release — disconnect the owner's SMS number. Releases it back to Twilio
// (stops the monthly charge) and soft-deletes the binding row. Best-effort on the Twilio side: a
// release failure there doesn't strand the owner — the binding is still flipped to 'released'.

import { createClient } from "@/lib/supabase/server";
import { twilioConfig } from "@/lib/connectors/sms/config";
import { releaseNumber } from "@/lib/connectors/sms/provision";
import { fetchActiveSmsNumber, releaseSmsNumber } from "@/lib/pa-sms-numbers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await fetchActiveSmsNumber(user.id);
  if (!existing.ok) {
    return NextResponse.json({ error: existing.error }, { status: existing.status });
  }
  if (!existing.data) {
    return NextResponse.json({ ok: true });
  }

  // Release at Twilio first (stops billing). A failure is non-fatal — surface it but still
  // soft-delete the binding so the owner's UI reflects the disconnect.
  const config = twilioConfig();
  let twilioError: string | null = null;
  if (config) {
    const released = await releaseNumber(config, existing.data.twilio_phone_sid);
    if (!released.ok) twilioError = released.error;
  }

  const result = await releaseSmsNumber(user.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, twilioError });
}
