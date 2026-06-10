// GET /api/app/mission-control/usage — the customer-facing Usage snapshot (PA-USAGE-4). Tier-
// denominated, never dollar-denominated: how much of the owner's plan they've used this month, per
// feature, plus a BYO real-cost block ONLY for owners on their own API key (PA-USAGE-7). Auth →
// snapshot. Live read (no cached rollup), matching the Operations tab.

import { createClient } from "@/lib/supabase/server";
import { getUsageSnapshot } from "@/lib/usage/snapshot";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const snapshot = await getUsageSnapshot(user.id);
    return NextResponse.json(snapshot);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Couldn't load your usage";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
