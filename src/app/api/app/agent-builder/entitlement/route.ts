// GET /api/app/agent-builder/entitlement — tells the homepage hero where its "Compose →"
// button should land (PA-POS-28 → PA-POS-27 hand-off). Entitled owners go straight to
// /app/apps/agent-builder with their spec; everyone else keeps the /start signup route.
//
// Entitlement today is tier-only (Studio+ / Enterprise). When the PA-POS-31 Project Pass
// lane lands, this is the ONE place that widens to `tier OR active pass for agent-builder`.

import { createClient } from "@/lib/supabase/server";
import { getCurrentTier, tierAllowsAgentBuilder } from "@/lib/personas/tier-caps";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ entitled: false });

  const tier = await getCurrentTier(user.id);
  return NextResponse.json({ entitled: tierAllowsAgentBuilder(tier) });
}
