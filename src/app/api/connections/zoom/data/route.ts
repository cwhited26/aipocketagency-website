// GET /api/connections/zoom/data?action=list_upcoming_meetings|get_meeting_link&...
// Read-only surface for the Zoom connector's read actions. Reads bypass the approval Inbox (task
// item 8), so they execute immediately against the connected account. Write actions (create_meeting
// / update_meeting / cancel_meeting) are NOT reachable here — they must be staged + approved through
// the orchestrator approval route. This endpoint 400s any non-read action so a write can never
// sneak through a GET.

import { createClient } from "@/lib/supabase/server";
import { executeZoomAction, isZoomAction, isZoomReadOnly } from "@/lib/connectors/zoom";
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
  const action = sp.get("action") ?? "";
  if (!isZoomAction(action) || !isZoomReadOnly(action)) {
    return NextResponse.json(
      { error: "Unknown or non-read Zoom action. Writes must be approved, not read here." },
      { status: 400 },
    );
  }

  const payload: Record<string, unknown> = {};
  if (action === "list_upcoming_meetings") {
    const sizeRaw = sp.get("page_size");
    if (sizeRaw !== null) {
      const n = Number.parseInt(sizeRaw, 10);
      if (Number.isFinite(n)) payload.page_size = n;
    }
  }
  if (action === "get_meeting_link") {
    if (sp.has("meeting_id")) payload.meeting_id = sp.get("meeting_id");
  }

  const result = await executeZoomAction({
    userId: user.id,
    action,
    payload,
    ownerEmail: user.email ?? null,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data);
}
