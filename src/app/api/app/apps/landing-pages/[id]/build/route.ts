// POST /api/app/apps/landing-pages/[id]/build — fire (or refire) a build cycle for a landing page.
//
// Generates the copy (owner's voice) + the page code, persists them, and stages the first connector
// step (create the GitHub repo) for approval. Each later step advances automatically as the owner
// approves the prior one (see lib/landing-pages/advance.ts + the approvals route). Studio+ gated.

import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { getCurrentTier, tierAllowsLandingPageBuilder } from "@/lib/personas/tier-caps";
import { getPage, toView } from "@/lib/landing-pages/pages";
import { startLandingPageBuild } from "@/lib/landing-pages/advance";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tier = await getCurrentTier(user.id);
  if (!tierAllowsLandingPageBuilder(tier)) {
    return NextResponse.json(
      {
        error: "upgrade_required",
        message: "The Landing Page Builder is a Studio feature. Upgrade to build a page on your own GitHub and Vercel.",
      },
      { status: 403 },
    );
  }

  const found = await getPage(params.id, user.id);
  if (!found.ok) return NextResponse.json({ error: found.error }, { status: found.status });
  if (!found.data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const page = found.data;

  if (page.status === "live") {
    return NextResponse.json({ page: toView(page), message: "This page is already live." });
  }
  if (page.status === "building") {
    return NextResponse.json(
      { page: toView(page), message: "This build is already underway — approve the next step in Mission Control." },
      { status: 409 },
    );
  }

  const paResult = await fetchPaUser(user.id);
  if (!paResult.ok || !paResult.data) {
    return NextResponse.json({ error: "User record not found" }, { status: 404 });
  }
  const paUser = paResult.data;
  if (!paUser.anthropic_api_key) {
    return NextResponse.json(
      { error: "no_api_key", message: "Add your Anthropic API key in Settings to build a page." },
      { status: 402 },
    );
  }

  const started = await startLandingPageBuild({
    page,
    ownerId: user.id,
    anthropicApiKey: paUser.anthropic_api_key,
    brainRepo: paUser.brain_repo,
    githubToken: paUser.github_token,
  });
  if (!started.ok) return NextResponse.json({ error: started.error }, { status: started.status });

  const refreshed = await getPage(params.id, user.id);
  const view = refreshed.ok && refreshed.data ? toView(refreshed.data) : toView(page);
  return NextResponse.json({ page: view, staged: started.staged });
}
