import { createClient } from "@/lib/supabase/server";
import { getRun, listLeadsForRun } from "@/lib/leads/runs";
import { leadsToCsv } from "@/lib/leads/csv";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Download a run's leads as a CSV. Owner-scoped through getRun's owner_id filter.
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

  const csv = leadsToCsv(leadsResult.data);
  const filename = `lead-scout-${params.id.slice(0, 8)}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
