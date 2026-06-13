// GET  /api/app/apps/landing-pages        — list the owner's landing pages
// POST /api/app/apps/landing-pages         — create a landing page (planning), { title, description, template }
//
// Studio / Studio+ / Enterprise only (PA-LPB-4) — the build stands up a real GitHub repo + Vercel
// project on the owner's accounts, so it sits with the other build-grade tooling. Lower tiers get a
// 403 with the upgrade path.

import { createClient } from "@/lib/supabase/server";
import { getCurrentTier, tierAllowsLandingPageBuilder } from "@/lib/personas/tier-caps";
import { fetchPaUser } from "@/lib/pa-supabase";
import { createPage, listPages, toView } from "@/lib/landing-pages/pages";
import {
  directionTierLabel,
  getDirection,
  isDirectionRef,
  resolveLandingTemplate,
  tierAllowsDirection,
  DIRECTION_REF_PREFIX,
} from "@/lib/landing-pages/directions";
import { sanitizeScope, readScopeBrandDomain } from "@/lib/landing-pages/scope";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(4000),
  /** A starter template id or a gallery direction ref ("direction:<slug>") — resolved below. */
  template: z.string().min(1).max(120),
  projectId: z.string().uuid().optional(),
  /** Repo-relative scope path from the wizard picker (PA-LPB-7). Sanitized server-side. */
  brainScope: z.string().max(200).optional(),
});

export async function GET(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await listPages(user.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ pages: result.data.map(toView) });
}

export async function POST(req: Request): Promise<NextResponse> {
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

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 422 });
  }
  if (!resolveLandingTemplate(parsed.data.template)) {
    return NextResponse.json({ error: "Unknown template" }, { status: 422 });
  }

  // Per-direction tier gate (PA-TG-2): a gallery direction can sit above the owner's tier even when
  // the App itself is open to them. Locked directions return the upgrade path, never a silent swap.
  if (isDirectionRef(parsed.data.template)) {
    const direction = getDirection(parsed.data.template.slice(DIRECTION_REF_PREFIX.length));
    if (!direction) {
      return NextResponse.json({ error: "Unknown template" }, { status: 422 });
    }
    if (!tierAllowsDirection(tier, direction)) {
      return NextResponse.json(
        {
          error: "upgrade_required",
          message: `"${direction.name}" unlocks at ${directionTierLabel(direction.tierRequired)}. Pick another template, or upgrade and it's yours.`,
        },
        { status: 403 },
      );
    }
  }

  let brainScope: string | null = null;
  try {
    brainScope = sanitizeScope(parsed.data.brainScope);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid brain scope" },
      { status: 422 },
    );
  }

  // PA-LPB-9 locked answer #4: read the domain from brand.json at create-time so the build flow
  // can propose attachDomain without re-fetching the brain after deploy.
  let brainScopeDomain: string | null = null;
  if (brainScope) {
    const paResult = await fetchPaUser(user.id);
    if (paResult.ok && paResult.data?.brain_repo && paResult.data.github_token) {
      brainScopeDomain = await readScopeBrandDomain(
        paResult.data.brain_repo,
        paResult.data.github_token,
        brainScope,
      );
    }
  }

  const created = await createPage({
    ownerId: user.id,
    title: parsed.data.title,
    description: parsed.data.description,
    template: parsed.data.template,
    projectId: parsed.data.projectId ?? null,
    brainScope,
    brainScopeDomain,
  });
  if (!created.ok) return NextResponse.json({ error: created.error }, { status: created.status });
  return NextResponse.json({ page: toView(created.data) }, { status: 201 });
}
