// /api/cron/reset-credit-cycles — daily roll of lapsed credit allowance cycles (PA-POS-30).
// For every studio_plus/enterprise owner whose cycle_end has passed, open the next 30-day cycle:
// fresh tier grant + any unused Top Up credits carried forward (paid-for credits are never
// clawed back). Owners who dropped below studio_plus simply stop getting rows — the chip
// disappears with the tier, which is the PA-POS-30 rule working as intended.
//
// The on-demand path in lib/metering/allowance.ts does the same roll at read time, so a chip
// render is never stale; this cron keeps the ledger tidy for owners who haven't opened an App
// page since renewal.

import { NextResponse } from "next/server";
import { getCurrentTier } from "@/lib/personas/tier-caps";
import { tierGetsCredits } from "@/lib/metering/credits";
import { rollAllowanceForward } from "@/lib/metering/allowance";
import { listLapsedAllowances } from "@/lib/metering/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nowIso = new Date().toISOString();
  const lapsed = await listLapsedAllowances(nowIso);

  // One owner can have several old rows; roll only from their newest lapsed cycle.
  const newestByOwner = new Map<string, (typeof lapsed)[number]>();
  for (const row of lapsed) {
    const prev = newestByOwner.get(row.owner_id);
    if (!prev || row.cycle_end > prev.cycle_end) newestByOwner.set(row.owner_id, row);
  }

  let rolled = 0;
  let skippedTier = 0;
  for (const [ownerId, row] of newestByOwner) {
    const tier = await getCurrentTier(ownerId);
    if (!tierGetsCredits(tier)) {
      skippedTier += 1;
      continue;
    }
    const next = await rollAllowanceForward(ownerId, tier as "studio_plus" | "enterprise", row, nowIso);
    if (next) rolled += 1;
  }

  console.info("[cron/reset-credit-cycles] tick complete", {
    lapsed_rows: lapsed.length,
    owners: newestByOwner.size,
    rolled,
    skipped_tier: skippedTier,
  });
  return NextResponse.json({ ok: true, rolled, skipped_tier: skippedTier });
}
