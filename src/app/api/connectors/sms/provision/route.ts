// /api/connectors/sms/provision — "Get my PA number". Provisions a dedicated Twilio number for the
// signed-in owner, wires its inbound webhook, and binds it in pa_sms_numbers. Idempotent: if the
// owner already has an active number, it's returned rather than buying a second one.

import { createClient } from "@/lib/supabase/server";
import { twilioConfig } from "@/lib/connectors/sms/config";
import { provisionNumber, normalizeAreaCode } from "@/lib/connectors/sms/provision";
import { fetchActiveSmsNumber, insertSmsNumber } from "@/lib/pa-sms-numbers";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  // Owner-chosen area code (NPA) or a full number to take the NPA from. Optional — falls back to
  // the national pool when absent or empty.
  areaCode: z.string().max(20).optional(),
});

export async function POST(req: Request): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = twilioConfig();
  if (!config) {
    return NextResponse.json(
      { error: "SMS isn't configured for this workspace yet. Add TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in Vercel." },
      { status: 503 },
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    raw = {};
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 422 });
  }

  // Already have one? Hand it back — never buy a second number for the same owner.
  const existing = await fetchActiveSmsNumber(user.id);
  if (!existing.ok) {
    return NextResponse.json({ error: existing.error }, { status: existing.status });
  }
  if (existing.data) {
    return NextResponse.json({ number: existing.data.e164_number, alreadyProvisioned: true });
  }

  const areaCode = normalizeAreaCode(parsed.data.areaCode);
  const provisioned = await provisionNumber(config, areaCode);
  if (!provisioned.ok) {
    return NextResponse.json({ error: provisioned.error }, { status: provisioned.status });
  }

  const inserted = await insertSmsNumber({
    ownerId: user.id,
    twilioPhoneSid: provisioned.data.sid,
    e164Number: provisioned.data.e164,
  });
  if (!inserted.ok) {
    return NextResponse.json({ error: inserted.error }, { status: inserted.status });
  }

  return NextResponse.json({ number: inserted.data.e164_number });
}
