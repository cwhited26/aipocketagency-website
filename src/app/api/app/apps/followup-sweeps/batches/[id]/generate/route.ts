// /api/app/apps/followup-sweeps/batches/[id]/generate — run a sweep now for one source ([id] is the
// source id). The dashboard's "Sweep now" button hits this; it does exactly what the weekly cron does
// for a single source (discover → draft → stage the batch + per-contact draft cards), respecting the
// 7-day re-draft cooldown so a manual run can't double-draft. Owner-scoped via the session.

import { createClient } from "@/lib/supabase/server";
import { getSource } from "@/lib/followup-sweeps/db";
import { sweepSource } from "@/lib/followup-sweeps/sweep";
import { fetchPaUser } from "@/lib/pa-supabase";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sourceResult = await getSource(params.id, user.id);
  if (!sourceResult.ok) {
    return NextResponse.json({ error: sourceResult.error }, { status: sourceResult.status });
  }
  if (!sourceResult.data) return NextResponse.json({ error: "Source not found" }, { status: 404 });

  const paResult = await fetchPaUser(user.id);
  if (!paResult.ok || !paResult.data) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }
  if (!paResult.data.anthropic_api_key) {
    return NextResponse.json(
      { error: "Add your Anthropic API key in Settings before running a sweep." },
      { status: 402 },
    );
  }

  const swept = await sweepSource({ source: sourceResult.data, ownerId: user.id, paUser: paResult.data });
  if (!swept.ok) return NextResponse.json({ error: swept.error }, { status: swept.status });

  return NextResponse.json({
    discovered: swept.data.discovered,
    staged: swept.data.staged.length,
    skippedCooldown: swept.data.skippedCooldown,
    suppressed: swept.data.suppressed,
  });
}
