// POST /api/cancel/intent — log a cancellation-flow entry (the reason picked). saved=false: the row
// records that the owner reached the save flow with this reason; the confirm route logs the actual
// cancel. Append-only; auth required.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { insertCancellationAttempt } from "@/lib/emails/queue";
import { isCancelReasonSlug } from "@/lib/cancel/flow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  let body: { reason?: unknown };
  try {
    body = (await req.json()) as { reason?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const reason = typeof body.reason === "string" ? body.reason : "";
  if (!isCancelReasonSlug(reason)) {
    return NextResponse.json({ error: "unknown reason" }, { status: 400 });
  }

  const insert = await insertCancellationAttempt({ ownerId: user.id, reason, saved: false });
  if (!insert.ok) {
    console.error("[cancel/intent] failed to log attempt", {
      owner_id: user.id,
      reason,
      status: insert.status,
      error: insert.error,
    });
    // Non-fatal to the user — the flow continues even if logging failed.
    return NextResponse.json({ ok: true, logged: false });
  }
  return NextResponse.json({ ok: true, logged: true });
}
