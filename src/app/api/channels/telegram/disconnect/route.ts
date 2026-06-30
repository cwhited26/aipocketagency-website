// POST /api/channels/telegram/disconnect — remove the owner's Telegram channel connection
// (PA-CHAN-1). Best-effort deletes the Telegram webhook first (so Telegram stops delivering), then
// deletes the pa_channel_connections row; pa_channel_messages cascade. Ownership-scoped.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchOwnerChannelConnectionFull, deleteChannelConnection } from "@/lib/channels/store";
import { telegramDeleteWebhook } from "@/lib/channels/adapters/telegram/api";
import { channelLog } from "@/lib/channels/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Tear the webhook down first while we still hold the (decrypted) bot token. Best-effort: a failure
  // here doesn't block the disconnect — the row delete is the source of truth.
  const full = await fetchOwnerChannelConnectionFull(user.id, "telegram");
  if (full.ok && full.data?.authToken) {
    const removed = await telegramDeleteWebhook(full.data.authToken);
    if (!removed.ok) {
      channelLog.warn("telegram deleteWebhook failed on disconnect", { reason: removed.error });
    }
  }

  const res = await deleteChannelConnection(user.id, "telegram");
  if (!res.ok) return NextResponse.json({ error: "disconnect_failed" }, { status: res.status });
  return NextResponse.json({ ok: true });
}
