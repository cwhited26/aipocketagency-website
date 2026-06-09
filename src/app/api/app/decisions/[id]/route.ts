// GET /api/app/decisions/[id] — the roundtable + its turns, for the live card's poll and the history
// detail view. When the Moderator has run, the parsed verdict (recommendation / dissent / evidence)
// rides along so the verdict card can pre-fill its editable area.

import { createClient } from "@/lib/supabase/server";
import { getRoundtable, getTurns } from "@/lib/decisions/db";
import { parseVerdict } from "@/lib/decisions/roles";
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

  const rt = await getRoundtable(params.id, user.id);
  if (!rt.ok) return NextResponse.json({ error: rt.error }, { status: rt.status });
  if (!rt.data) return NextResponse.json({ error: "Roundtable not found" }, { status: 404 });

  const turns = await getTurns(params.id, user.id);
  if (!turns.ok) return NextResponse.json({ error: turns.error }, { status: turns.status });

  const moderator = turns.data.find((t) => t.role === "moderator");
  const verdict = moderator ? parseVerdict(moderator.content) : null;

  return NextResponse.json({ roundtable: rt.data, turns: turns.data, verdict });
}
