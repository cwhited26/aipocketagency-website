// GET /api/app/pocket-capture/reminders — the signed-in user's recent reminders (PC-CORE-5) for the
// dashboard feed. Returns the last 50 newest-first. The dashboard UI that renders this feed lands in
// PC-CORE-6; this endpoint is the data seam it consumes.
//
// Auth: the session user from the Supabase server client; the data read is service-role filtered by
// owner_id (the same pattern the SMS-number endpoint uses), so an unauthenticated request gets 401.

import { createClient } from "@/lib/supabase/server";
import { listRecentReminders } from "@/lib/pocket-capture/reminders/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await listRecentReminders(user.id, 50);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({ reminders: result.data });
}
