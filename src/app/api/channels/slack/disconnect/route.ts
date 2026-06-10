// POST /api/channels/slack/disconnect — remove the owner's Slack channel connection (PA-CHAN-1).
// Deletes the pa_channel_connections row; pa_channel_messages cascade. Ownership-scoped.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteChannelConnection } from "@/lib/channels/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const res = await deleteChannelConnection(user.id, "slack");
  if (!res.ok) return NextResponse.json({ error: "disconnect_failed" }, { status: res.status });
  return NextResponse.json({ ok: true });
}
