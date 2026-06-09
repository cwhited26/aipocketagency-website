// /api/app/apps/followup-sweeps/sources/[id]/contacts — the contacts a source has seen, for the
// dashboard's "leave alone" list (PA-FUS-5). Owner-scoped via the session.

import { createClient } from "@/lib/supabase/server";
import { listContactsForSource } from "@/lib/followup-sweeps/db";
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

  const result = await listContactsForSource(params.id, user.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ contacts: result.data });
}
