// GET /api/app/decisions — the owner's roundtable history (the /app/decisions page list). Question,
// verdict summary, status, date, and the model backings used, newest first.

import { createClient } from "@/lib/supabase/server";
import { listRoundtables } from "@/lib/decisions/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await listRoundtables(user.id, 100);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ roundtables: result.data });
}
