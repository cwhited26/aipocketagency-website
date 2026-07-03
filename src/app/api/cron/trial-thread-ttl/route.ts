// /api/cron/trial-thread-ttl — the §22.2 fourteen-day TTL sweep (PA-POS-32). Unconverted
// trial threads idle past the TTL flip to expired and drop their encrypted conversation
// state. Idempotent; same Bearer CRON_SECRET guard as the other crons.

import { NextResponse } from "next/server";
import { sweepExpiredTrialThreads } from "@/lib/onboarding/whatsapp-cold/db";
import { TRIAL_TTL_MS } from "@/lib/onboarding/whatsapp-cold/types";
import { coldLog } from "@/lib/onboarding/whatsapp-cold/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - TRIAL_TTL_MS).toISOString();
  const swept = await sweepExpiredTrialThreads(cutoff);
  if (!swept.ok) {
    coldLog.error("trial TTL sweep failed", { status: swept.status, error: swept.error });
    return NextResponse.json({ error: "sweep failed" }, { status: 502 });
  }

  coldLog.info("trial TTL sweep complete", { expired: swept.data, cutoff });
  return NextResponse.json({ ok: true, expired: swept.data, cutoff });
}
