// /api/cron/rituals — the Ritual Scheduler sweep (PA-RITUAL-4).
//
// Registered in vercel.json on `*/5 * * * *` (every five minutes). Each run fires the enabled rituals
// whose next_run_at is due: stages each result as a Mission Control card, advances the cursor, and
// auto-pauses any ritual that's failed five times in a row. Service-role (no user session); each ritual
// carries the owner_id the run threads through. Same Bearer-secret guard as the other crons.

import { NextResponse } from "next/server";
import { sweepDueRituals } from "@/lib/rituals/sweep";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const swept = await sweepDueRituals();
  if (!swept.ok) return NextResponse.json({ error: swept.error }, { status: 500 });

  return NextResponse.json({ due: swept.data.due, ran: swept.data.ran });
}
