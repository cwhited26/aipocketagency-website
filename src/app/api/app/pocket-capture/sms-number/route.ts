// GET /api/app/pocket-capture/sms-number — return the signed-in user's SMS capture number
// (PC-CORE-3). Lazily provisions a dedicated Twilio number on first read for an existing PA user
// who never had Pocket Capture (the Stripe-checkout path provisions it up front; this is the
// fallback). Returns { phone_number, sms_link } so the dashboard can surface it for save-to-contacts
// and a tap-to-text deep link. The dashboard renders the QR (qr_code_url) client-side from sms_link.
//
// SMS isn't available without Twilio configured: rather than 500-ing the dashboard, we return
// { phone_number: null } with a soft reason so the UI can show "SMS isn't available yet."

import { createClient } from "@/lib/supabase/server";
import { provisionTwilioNumber } from "@/lib/connectors/twilio/provision";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A tap-to-text deep link the dashboard can render directly or encode into a QR. */
function smsLink(phoneNumber: string): string {
  return `sms:${phoneNumber}`;
}

export async function GET(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await provisionTwilioNumber({ ownerId: user.id });
  if (!result.ok) {
    // 501 = Twilio not configured: a soft "not available yet", not a hard error for the dashboard.
    if (result.status === 501) {
      return NextResponse.json({ phone_number: null, reason: "sms-unavailable" });
    }
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    phone_number: result.phoneNumber,
    sms_link: smsLink(result.phoneNumber),
  });
}
