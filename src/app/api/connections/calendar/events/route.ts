// GET /api/connections/calendar/events?time_min=&time_max=&max_results=&calendar_id=
// Read-only surface for the Calendar connector's list_events action. Read actions bypass the
// approval Inbox (task item 5), so this executes immediately against the connected calendar.

import { createClient } from "@/lib/supabase/server";
import { runCalendarAction } from "@/lib/connectors/calendar";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const payload: Record<string, unknown> = {};
  if (sp.has("time_min")) payload.time_min = sp.get("time_min");
  if (sp.has("time_max")) payload.time_max = sp.get("time_max");
  if (sp.has("calendar_id")) payload.calendar_id = sp.get("calendar_id");
  const maxRaw = sp.get("max_results");
  if (maxRaw !== null) {
    const n = Number.parseInt(maxRaw, 10);
    if (Number.isFinite(n)) payload.max_results = n;
  }

  const result = await runCalendarAction({
    userId: user.id,
    action: "list_events",
    payload,
    requestId: "list_events", // unused for reads (only create_event seeds idempotency)
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error, reauth: result.reauth }, { status: result.status });
  }
  return NextResponse.json(result.data);
}
