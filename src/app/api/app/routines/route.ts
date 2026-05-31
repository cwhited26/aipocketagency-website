import { createClient } from "@/lib/supabase/server";
import { ensureUserRoutines, listRoutines } from "@/lib/pa-routines";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Idempotent — inserts the 3 defaults only if they don't exist yet.
  const ensureResult = await ensureUserRoutines(user.id);
  if (!ensureResult.ok) {
    return NextResponse.json({ error: ensureResult.error }, { status: ensureResult.status });
  }

  const listResult = await listRoutines(user.id);
  if (!listResult.ok) {
    return NextResponse.json({ error: listResult.error }, { status: listResult.status });
  }

  return NextResponse.json({ routines: listResult.data });
}
