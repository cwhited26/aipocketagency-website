// POST /api/channels/whatsapp/connect — pair the owner's WhatsApp Business Cloud API number
// (Channels Gateway Phase 4, PA-CHAN-12). The owner pastes their Phone Number ID + access token +
// app secret and their own WhatsApp number (the only routed sender). This route authenticates the
// owner, gates on tier (PA-CHAN-7), validates the pair against Graph, and upserts the connection
// (connect.ts). Secrets are AES-256-GCM encrypted before insert.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTier, tierAllowsChannel } from "@/lib/personas/tier-caps";
import { connectWhatsappChannel } from "@/lib/channels/adapters/whatsapp/connect";
import { channelLog } from "@/lib/channels/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  phoneNumberId: z.string().min(1).max(64),
  accessToken: z.string().min(1).max(1000),
  appSecret: z.string().min(1).max(200),
  ownerNumber: z.string().min(1).max(20),
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
  if (!tierAllowsChannel(tier, "whatsapp")) {
    return NextResponse.json({ error: "tier_blocked" }, { status: 403 });
  }

  const result = await connectWhatsappChannel({ ownerId: user.id, ...parsed.data });
  if (!result.ok) {
    channelLog.warn("whatsapp connect failed", { reason: result.error });
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, displayNumber: result.displayNumber });
}
