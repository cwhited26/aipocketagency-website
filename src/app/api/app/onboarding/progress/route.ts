// GET /api/app/onboarding/progress — the progress chip's one read (PA-POS-36). Returns the
// owner's completed step slugs plus the two tier facts the chip needs: whether this tier earns
// credit bonuses (Studio+/Enterprise, the PA-POS-30 gate) and whether it's Personal Brain
// (starter), where the teammate invite is optional and may be skipped.

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getOnboardingProgress } from "@/lib/onboarding/progress";
import { getCurrentTier } from "@/lib/personas/tier-caps";
import { tierGetsCredits } from "@/lib/metering/credits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [rows, tier] = await Promise.all([
    getOnboardingProgress(user.id),
    getCurrentTier(user.id),
  ]);

  return NextResponse.json({
    completed: rows.map((r) => r.step_slug),
    creditRewards: tierGetsCredits(tier),
    starterTier: tier === "starter",
  });
}
