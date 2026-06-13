// GET /api/app/apps/landing-pages/project-folders
//
// Returns the project / client folders discovered in the owner's brain repo — the picker data for
// the Landing Page Builder wizard's "A specific project or client" branch (PA-LPB-9). Requires the
// owner to have a connected brain repo + GitHub token; returns [] when not connected (degrade clean).
// Studio / Studio+ / Enterprise only (same gate as the builder itself, PA-LPB-4).

import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { getCurrentTier, tierAllowsLandingPageBuilder } from "@/lib/personas/tier-caps";
import { discoverProjectFolders } from "@/lib/landing-pages/scope";
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
    return NextResponse.json({ folders: [] });
  }

  const paResult = await fetchPaUser(user.id);
  if (!paResult.ok || !paResult.data?.brain_repo) {
    return NextResponse.json({ folders: [] });
  }

  const folders = await discoverProjectFolders(
    paResult.data.brain_repo,
    paResult.data.github_token ?? null,
  );

  return NextResponse.json({ folders });
}
