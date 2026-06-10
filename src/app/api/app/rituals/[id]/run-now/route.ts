// /api/app/rituals/[id]/run-now — fire a ritual on demand, off-schedule.
//
// The owner taps "Run now" on a ritual to see it work without waiting for its next slot. Runs the same
// executor the cron uses, so the result lands in Mission Control identically (and advances next_run_at,
// so an on-demand run also resets the cursor). Owner-scoped: getRitual gates ownership before running.

import { createClient } from "@/lib/supabase/server";
import { getRitual } from "@/lib/rituals/db";
import { runRitual } from "@/lib/rituals/run";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ritual = await getRitual(params.id, user.id);
  if (!ritual.ok) return NextResponse.json({ error: ritual.error }, { status: ritual.status });
  if (!ritual.data) return NextResponse.json({ error: "Ritual not found" }, { status: 404 });

  const report = await runRitual(ritual.data);
  return NextResponse.json({ report });
}
