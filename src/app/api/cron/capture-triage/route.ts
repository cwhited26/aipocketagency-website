// /api/cron/capture-triage — the weekly Capture Inbox triage sweep (PA-CAPTURE-2).
//
// Registered in vercel.json on `0 9 * * 1` (Monday 9am). Every run reads each owner's still-unfiled
// memory/inbox.md entries — the ones no routing rule and no ingester has already folded into a
// dedicated note — classifies each with one cheap Haiku call, and stages a capture_triage_proposal
// card per entry: the suggested bucket + target path the owner approves / rejects / edits. Nothing
// moves on its own — filing happens only when the owner approves the card. Service-role (no user
// session); each owner carries the brain repo + token + Anthropic key the sweep threads through.

import { NextResponse } from "next/server";
import { fetchTriageOwners, runTriageForOwner } from "@/lib/capture-inbox/triage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type OwnerResult = {
  ownerId: string;
  entriesSeen: number;
  staged: number;
  skipped: number;
};

export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const owners = await fetchTriageOwners();

  const results: OwnerResult[] = [];
  for (const owner of owners) {
    const swept = await runTriageForOwner(owner);
    results.push({ ownerId: owner.id, ...swept });
  }

  const totalStaged = results.reduce((sum, r) => sum + r.staged, 0);
  return NextResponse.json({ processed: owners.length, staged: totalStaged, results });
}
