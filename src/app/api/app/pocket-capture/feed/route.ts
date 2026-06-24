// GET /api/app/pocket-capture/feed?limit=N — the most recent captures for the signed-in user,
// newest first. The onboarding wizard polls this (limit=1) to confirm the buyer's first capture
// landed (PC-MARK-3, step 4). Captures live in the owner's brain at memory/inbox.md (the shared
// Capture Inbox write path), so we read + parse that file. This is intentionally minimal — the rich
// dashboard feed (search, tags, edit/delete, pagination) is PC-CORE-6's job; PC-CORE-6 will own/extend
// this endpoint. Returns { captures: [] } (not an error) when the brain isn't provisioned yet.

import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { fetchFileContent } from "@/lib/pa-brain";
import { parseInboxForDisplay } from "@/lib/pa-inbox";
import { recentFeedItems, CAPTURE_INBOX_PATH } from "@/lib/pocket-capture/feed";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  // 1..50; the wizard polls with 1. Coerce the string query param, default 20.
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export async function GET(request: Request): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = querySchema.safeParse({
    limit: new URL(request.url).searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid limit", details: parsed.error.flatten() }, { status: 400 });
  }

  const paResult = await fetchPaUser(user.id);
  if (!paResult.ok) return NextResponse.json({ error: paResult.error }, { status: paResult.status });

  const pa = paResult.data;
  // No brain provisioned yet → no captures to show. Not an error: the wizard keeps polling.
  if (!pa || !pa.brain_repo) return NextResponse.json({ captures: [] });

  const raw = await fetchFileContent(pa.brain_repo, CAPTURE_INBOX_PATH, pa.github_token);
  const entries = parseInboxForDisplay(raw);
  return NextResponse.json({ captures: recentFeedItems(entries, parsed.data.limit) });
}
