// /api/cron/followup-sweeps — the weekly Follow-Up Sweeps run (PA-FUS-4).
//
// Registered in vercel.json on `0 8 * * 0` (Sunday 8am). Every run sweeps the enabled sources whose
// next_sweep_at is due: discovers dormant contacts, drafts the next touch in the owner's voice via the
// shipped Email Drafter, and stages each draft + one follow_up_sweep_batch summary card in Mission
// Control. Nothing sends on its own — every draft stages for the owner's tap, exactly like Lead Scout
// outreach. Service-role (no user session); each source carries the owner_id the sweep threads through.

import { NextResponse } from "next/server";
import { fetchDueSources } from "@/lib/followup-sweeps/db";
import { sweepSource } from "@/lib/followup-sweeps/sweep";
import { fetchPaUser } from "@/lib/pa-supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type SourceResult = {
  sourceId: string;
  status: "ok" | "skipped" | "error";
  reason?: string;
  drafts?: number;
};

export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const due = await fetchDueSources();
  if (!due.ok) return NextResponse.json({ error: due.error }, { status: 500 });

  const results: SourceResult[] = [];
  for (const source of due.data) {
    const paResult = await fetchPaUser(source.owner_id);
    if (!paResult.ok || !paResult.data) {
      results.push({ sourceId: source.id, status: "skipped", reason: "Account not found" });
      continue;
    }
    const paUser = paResult.data;
    if (!paUser.anthropic_api_key) {
      results.push({ sourceId: source.id, status: "skipped", reason: "No Anthropic API key" });
      continue;
    }

    const swept = await sweepSource({ source, ownerId: source.owner_id, paUser });
    if (!swept.ok) {
      results.push({ sourceId: source.id, status: "error", reason: swept.error });
      continue;
    }
    results.push({ sourceId: source.id, status: "ok", drafts: swept.data.staged.length });
  }

  return NextResponse.json({ processed: due.data.length, results });
}
