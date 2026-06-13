// GET /api/app/apps/landing-pages/moonchild-scenes
// List the owner's Moonchild scenes for the Path A scene picker in the LPB wizard. (PA-LPB-13)

import { createClient } from "@/lib/supabase/server";
import { resolveMoonchildToken } from "@/lib/pa-moonchild-connections";
import { listMoonchildScenesWithCredentials } from "@/lib/connectors/moonchild/client";
import { tierAllowsLandingPageBuilder } from "@/lib/personas/tier-caps";
import { getCurrentTier } from "@/lib/personas/tier-caps";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tier = await getCurrentTier(user.id);
  if (!tierAllowsLandingPageBuilder(tier)) {
    return NextResponse.json({ error: "Landing Page Builder is a Studio feature." }, { status: 403 });
  }

  const creds = await resolveMoonchildToken(user.id);
  if (!creds.ok) {
    return NextResponse.json({ error: creds.error }, { status: creds.status });
  }

  const result = await listMoonchildScenesWithCredentials(
    { mcpUrl: creds.mcpUrl, token: creds.token },
    user.id,
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error.message }, { status: 502 });
  }

  return NextResponse.json({ scenes: result.data });
}
