// POST /api/channels/sms/connect — pair the owner's Twilio account for the SMS channel (Channels
// Gateway Phase 2, PA-CHAN-9/10). No OAuth: the owner pastes their Account SID + auth token, the
// number (or Messaging Service) the agent texts from, and their own cell (the only routed sender).
// This route authenticates the owner, gates on tier (PA-CHAN-7), validates the credential pair
// against Twilio, and upserts the connection (connect.ts). The auth token is AES-256-GCM encrypted
// before it touches the DB.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTier, tierAllowsChannel } from "@/lib/personas/tier-caps";
import { connectSmsChannel } from "@/lib/channels/adapters/sms/connect";
import { channelLog } from "@/lib/channels/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  accountSid: z.string().min(1).max(100),
  authToken: z.string().min(1).max(200),
  ownerPhone: z.string().min(1).max(20),
  fromNumber: z.string().max(20).optional(),
  messagingServiceSid: z.string().max(100).optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  // Tier gate (defense-in-depth; the card also hides connect below Business Agent).
  const tier = await getCurrentTier(user.id);
  if (!tierAllowsChannel(tier, "sms")) {
    return NextResponse.json({ error: "tier_blocked" }, { status: 403 });
  }

  const result = await connectSmsChannel({ ownerId: user.id, ...parsed.data });
  if (!result.ok) {
    channelLog.warn("sms connect failed", { reason: result.error });
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, ownerPhone: result.ownerPhone });
}
