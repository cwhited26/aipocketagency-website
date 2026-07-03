// POST /api/channels/imessage/connect — pair the owner's self-hosted BlueBubbles server for the
// iMessage channel (Channels Gateway Phase 3, PA-CHAN-11). The owner pastes their server URL +
// password + a webhook secret and the iMessage handle they text from. This route authenticates the
// owner, gates on tier (Studio+ / Enterprise — PA-CHAN-7), validates the server pair via ping, and
// upserts the connection (connect.ts). Secrets are AES-256-GCM encrypted before insert.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTier, tierAllowsChannel } from "@/lib/personas/tier-caps";
import { connectImessageChannel } from "@/lib/channels/adapters/imessage/connect";
import { channelLog } from "@/lib/channels/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  serverUrl: z.string().min(1).max(500),
  password: z.string().min(1).max(200),
  webhookSecret: z.string().min(1).max(256),
  ownerHandle: z.string().min(1).max(100),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  // Tier gate (defense-in-depth; the card also hides connect below Studio+).
  const tier = await getCurrentTier(user.id);
  if (!tierAllowsChannel(tier, "imessage")) {
    return NextResponse.json({ error: "tier_blocked" }, { status: 403 });
  }

  const result = await connectImessageChannel({ ownerId: user.id, ...parsed.data });
  if (!result.ok) {
    channelLog.warn("imessage connect failed", { reason: result.error });
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, ownerHandle: result.ownerHandle });
}
