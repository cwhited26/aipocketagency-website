import { createClient } from "@/lib/supabase/server";
import { getRun, listLeadsForRun } from "@/lib/leads/runs";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Return a run plus its leads (the run page + the Mission Control card both read this).
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const runResult = await getRun(params.id, user.id);
  if (!runResult.ok) return NextResponse.json({ error: runResult.error }, { status: runResult.status });
  if (!runResult.data) return NextResponse.json({ error: "Run not found" }, { status: 404 });

  const leadsResult = await listLeadsForRun(params.id, user.id);
  if (!leadsResult.ok) {
    return NextResponse.json({ error: leadsResult.error }, { status: leadsResult.status });
  }

  return NextResponse.json({ run: runResult.data, leads: leadsResult.data });
}
