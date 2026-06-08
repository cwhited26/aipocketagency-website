// POST /api/app/youtube/first-touch — dismiss the one-time "PA reads YouTube links" chat-box hint.
// Persists chat_hint_dismissed_at on the owner's pa_youtube_prefs row so the hint never returns.

import { createClient } from "@/lib/supabase/server";
import { upsertYouTubePrefs } from "@/lib/youtube/prefs";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await upsertYouTubePrefs(user.id, { chatHintDismissed: true });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
  return NextResponse.json({ ok: true });
}
