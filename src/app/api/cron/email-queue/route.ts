// /api/cron/email-queue — drains the email queue every 5 minutes (vercel.json `*/5`). Renders up to
// 100 due emails, sends each via Resend, records sent/failed with backoff. Same Bearer-secret guard as
// the other crons; service-role only (no user session).

import { NextResponse } from "next/server";
import { sweepEmailQueue } from "@/lib/emails/sweep";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const swept = await sweepEmailQueue(100);
  if (!swept.ok) return NextResponse.json({ error: swept.error }, { status: 500 });

  return NextResponse.json({ ok: true, ...swept.data });
}
