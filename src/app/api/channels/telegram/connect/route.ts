// POST /api/channels/telegram/connect — pair the owner's Telegram bot (Channels Gateway Phase 2).
//
// Telegram has no OAuth redirect: the owner mints a bot in BotFather and pastes its token + a webhook
// secret. This route authenticates the owner, gates on tier (PA-CHAN-7), validates the token via
// getMe, registers the webhook with the secret, and upserts the connection (connect.ts). Returns the
// resolved bot username so the settings card can show "@your_bot — connected".

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTier, tierAllowsChannel } from "@/lib/personas/tier-caps";
import { connectTelegramBot } from "@/lib/channels/adapters/telegram/connect";
import { channelLog } from "@/lib/channels/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Telegram bot tokens are "<botId>:<35-char secret>"; the webhook secret is 1–256 of [A-Za-z0-9_-].
const BodySchema = z.object({
  botToken: z.string().min(1).max(200),
  webhookSecret: z.string().min(1).max(256),
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
  if (!tierAllowsChannel(tier, "telegram")) {
    return NextResponse.json({ error: "tier_blocked" }, { status: 403 });
  }

  const result = await connectTelegramBot({
    ownerId: user.id,
    botToken: parsed.data.botToken,
    webhookSecret: parsed.data.webhookSecret,
  });
  if (!result.ok) {
    channelLog.warn("telegram connect failed", { reason: result.error });
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, botUsername: result.botUsername });
}
