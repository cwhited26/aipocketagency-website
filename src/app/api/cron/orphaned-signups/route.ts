// /api/cron/orphaned-signups — hourly sweep (vercel.json). Re-sends the login link to pay-first buyers
// who paid but never signed in, at 24h and 72h. Idempotent via email_sequence_state stamps.

import { NextResponse } from "next/server";
import { sweepOrphanedSignups } from "@/lib/orphaned-signups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const swept = await sweepOrphanedSignups(new Date());
  if (!swept.ok) return NextResponse.json({ error: swept.error }, { status: 500 });

  return NextResponse.json({ ok: true, ...swept.data });
}
