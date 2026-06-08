// POST /api/app/youtube/brief-toggle — set the Daily-Brief "include YouTube ingests" opt-in.
// Body: { enabled: boolean }. Persists daily_brief_include on the owner's pa_youtube_prefs row.

import { createClient } from "@/lib/supabase/server";
import { upsertYouTubePrefs, fetchYouTubePrefs } from "@/lib/youtube/prefs";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ enabled: z.boolean() });

export async function GET(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prefs = await fetchYouTubePrefs(user.id);
  return NextResponse.json({ enabled: prefs.dailyBriefInclude });
}

export async function POST(req: Request): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Expected { enabled: boolean }" }, { status: 422 });

  const result = await upsertYouTubePrefs(user.id, { dailyBriefInclude: parsed.data.enabled });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
  return NextResponse.json({ ok: true, enabled: parsed.data.enabled });
}
