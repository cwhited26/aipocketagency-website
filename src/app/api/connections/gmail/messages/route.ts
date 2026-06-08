// GET /api/connections/gmail/messages?limit=
// Read-only surface for the Gmail connector — most-recent inbox messages, newest first.
// Reads bypass the approval Inbox, so this executes immediately against the connected
// mailbox. Powers the top-level Email view.

import { createClient } from "@/lib/supabase/server";
import { gmailListRecent } from "@/lib/connectors/gmail/read";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limitRaw = request.nextUrl.searchParams.get("limit");
  const parsed = limitRaw !== null ? Number.parseInt(limitRaw, 10) : NaN;
  const limit = Number.isFinite(parsed) ? parsed : 10;

  const result = await gmailListRecent(user.id, limit);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, reauth: result.reauth },
      { status: result.status },
    );
  }
  return NextResponse.json({ messages: result.messages });
}
