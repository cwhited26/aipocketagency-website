// POST /api/app/usage/decision  { decision: "keep_going" | "pause" }
// The owner's answer to the 80% tier-limit warn (PA-USAGE-6): "Continue using what's left"
// (keep_going) acks the warn for the rest of the month so the dispatcher stops pausing on it;
// "pause" holds new background runs until the plan resets. Stored per (owner, period) — the same
// ack store the cost surface used, now usage-framed. There is no dollar cap to set: the only way to
// get MORE headroom is to upgrade, which happens in Settings → Tier & limits / Billing.

import { createClient } from "@/lib/supabase/server";
import { recordPeriodDecision, type PeriodDecision } from "@/lib/usage/db";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({ decision: z.enum(["keep_going", "pause"]) });

export async function POST(req: Request): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let decision: PeriodDecision;
  try {
    const raw = (await req.json().catch(() => ({}))) as unknown;
    decision = Schema.parse(raw).decision;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    await recordPeriodDecision(user.id, decision);
    return NextResponse.json({ ok: true, decision });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Couldn't save your choice";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
