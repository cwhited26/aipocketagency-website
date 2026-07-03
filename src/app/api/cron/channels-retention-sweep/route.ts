// /api/cron/channels-retention-sweep — the 30-day retention sweep for pa_channel_messages
// (PA-CHAN-3, migration 074's retention plan): nulls the verbatim provider payload on rows older
// than 30 days, keeping the message row for the owner's audit trail. Registered in vercel.json
// daily. Authenticates with CRON_SECRET (Authorization: Bearer …). Idempotent — a re-run matches
// zero rows because the filter excludes already-nulled payloads.

import { NextResponse } from "next/server";
import { channelLog } from "@/lib/channels/log";
import { sweepChannelMessageRetention } from "@/lib/channels/retention";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sweepChannelMessageRetention();
  if (!result.ok) {
    // The sweep already logged the PATCH failure with its status + body; the cron surface returns
    // 500 so a failing sweep shows up in the Vercel cron dashboard instead of reading as green.
    return NextResponse.json({ error: "Retention sweep failed" }, { status: 500 });
  }

  channelLog.info("retention sweep complete", { swept: result.swept, cutoff: result.cutoff });
  return NextResponse.json({ ok: true, swept: result.swept, cutoff: result.cutoff });
}
