// GET /api/app/mission-control/cost?period=day|week|month
//
// The Cost tab's read (Cost Observability SPEC §5.5, Phase 2). Auth → fold the owner's metered events
// over the period window into the tiles + spend-over-time line + the three breakdowns. Read-only: no
// budgets, no gate (Phase 3 + Phase 4). The aggregation + 8s per-owner cache live in lib/cost-rollup;
// this is the thin auth-then-fold shell. The ledger is owner-RLS, but the fold runs service-role for
// the SUM, so the owner_id filter inside the loader is what scopes the read to the caller.

import { createClient } from "@/lib/supabase/server";
import { getCostRollup, isCostPeriod, type CostPeriod } from "@/lib/mission-control/cost-rollup";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raw = new URL(req.url).searchParams.get("period") ?? "month";
  const period: CostPeriod = isCostPeriod(raw) ? raw : "month"; // default Month (PA-COST-6)

  try {
    const rollup = await getCostRollup({ ownerId: user.id, period });
    return NextResponse.json(rollup);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load cost";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
