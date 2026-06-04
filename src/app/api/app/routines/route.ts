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

  // Idempotent — upserts the 3 defaults (ON CONFLICT DO NOTHING) on every load.
  const ensureResult = await ensureUserRoutines(user.id);
  if (!ensureResult.ok) {
    // Never leak raw PostgREST errors to the client; log detail server-side.
    console.error("[app/routines] ensureUserRoutines failed", {
      userId: user.id,
      status: ensureResult.status,
      error: ensureResult.error,
    });
    return NextResponse.json(
      { error: "Routines configuration error" },
      { status: 500 },
    );
  }

  const listResult = await listRoutines(user.id);
  if (!listResult.ok) {
    console.error("[app/routines] listRoutines failed", {
      userId: user.id,
      status: listResult.status,
      error: listResult.error,
    });
    return NextResponse.json(
      { error: "Routines configuration error" },
      { status: 500 },
    );
  }

  return NextResponse.json({ routines: listResult.data });
}
