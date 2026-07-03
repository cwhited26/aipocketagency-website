// GET /api/app/agent-builder/entitlement — tells the homepage hero where its "Compose →"
// button should land (PA-POS-28 → PA-POS-27 hand-off). Entitled owners go straight to
// /app/apps/agent-builder with their spec; everyone else keeps the /start signup route.
//
// Widened per PA-POS-31: tier OR active Project Pass for agent_builder.

import { createClient } from "@/lib/supabase/server";
import { hasAppEntitlement } from "@/lib/metering/entitlement";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ entitled: false });

  const access = await hasAppEntitlement(user.id, "agent_builder");
  return NextResponse.json({ entitled: access.allowed });
}
