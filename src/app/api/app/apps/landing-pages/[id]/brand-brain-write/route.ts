// POST /api/app/apps/landing-pages/[id]/brand-brain-write — stage a push_files approval card
// that will write brand.json to the owner's brain at the page's scope path (PA-LPB-12).
//
// Requires the page to have a brain_scope and a design_system_snapshot already persisted (call
// import-design-system first). Checks whether brand.json already exists at the scope root and
// surfaces the "replacing existing" flag in the staged card preview. The owner approves the card
// in Mission Control; the existing github_build push_files executor does the actual commit.

import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { getCurrentTier, tierAllowsLandingPageBuilder } from "@/lib/personas/tier-caps";
import { getPage } from "@/lib/landing-pages/pages";
import { hasExistingBrandJson, stageBrandJsonWrite } from "@/lib/landing-pages/brand-brain";
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
        message: "The Landing Page Builder is a Studio feature.",
      },
      { status: 403 },
    );
  }

  const found = await getPage(params.id, user.id);
  if (!found.ok) return NextResponse.json({ error: found.error }, { status: found.status });
  if (!found.data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const page = found.data;

  if (!page.brain_scope) {
    return NextResponse.json(
      { error: "no_scope", message: "Select a project scope before writing to your brain." },
      { status: 422 },
    );
  }

  const snapshot = page.design_system_snapshot;
  if (!snapshot) {
    return NextResponse.json(
      { error: "no_design_system", message: "Import a design system first." },
      { status: 422 },
    );
  }

  const paResult = await fetchPaUser(user.id);
  if (!paResult.ok || !paResult.data) {
    return NextResponse.json({ error: "User record not found" }, { status: 404 });
  }
  const paUser = paResult.data;

  if (!paUser.brain_repo) {
    return NextResponse.json(
      { error: "no_brain", message: "Connect your brain repo in Settings first." },
      { status: 422 },
    );
  }

  const replacingExisting = await hasExistingBrandJson(
    paUser.brain_repo,
    paUser.github_token,
    page.brain_scope,
  );

  const result = await stageBrandJsonWrite({
    ownerId: user.id,
    brainRepo: paUser.brain_repo,
    githubToken: paUser.github_token,
    scope: page.brain_scope,
    brand: {
      name: snapshot.name ?? page.title,
      ds: {
        id: snapshot.id,
        name: snapshot.name,
        palette: snapshot.palette,
        typography: snapshot.typography,
        components: snapshot.components,
      },
      sourceUrl: snapshot.importedFrom ?? page.design_system_imported_from ?? "",
    },
    replacingExisting,
    landingPageId: page.id,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({ staged: true, replacingExisting });
}
