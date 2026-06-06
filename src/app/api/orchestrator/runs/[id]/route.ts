// GET /api/orchestrator/runs/<id>
// Run status + phase timeline for the chat's sub-agent-activity card. Ownership is enforced in
// code (service-role read scoped by business_id = the caller) on top of RLS.

import { createClient } from "@/lib/supabase/server";
import { fetchRun, listPhaseLog } from "@/lib/orchestrator/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const run = await fetchRun(params.id);
  if (!run || run.business_id !== user.id) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const phases = await listPhaseLog(run.id);
  return NextResponse.json({ run, phases });
}
