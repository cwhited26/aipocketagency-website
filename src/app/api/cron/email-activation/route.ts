// /api/cron/email-activation — the daily activation sweep (vercel.json `0 10 * * *`). For each active
// subscriber, reads activation state and enqueues the one missing-action reminder that fits (max one per
// owner per 7 days), or the 3-3-3 celebration on completion. Idempotent via pa_email_activation_state.

import { NextResponse } from "next/server";
import { sweepActivationTriggers } from "@/lib/emails/activation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const swept = await sweepActivationTriggers(500);
  if (!swept.ok) return NextResponse.json({ error: swept.error }, { status: 500 });

  return NextResponse.json({ ok: true, ...swept.data });
}
