// GET  /api/app/apps/landing-pages        — list the owner's landing pages
// POST /api/app/apps/landing-pages         — create a landing page (planning), { title, description, template }
//
// Studio / Studio+ / Enterprise only (PA-LPB-4) — the build stands up a real GitHub repo + Vercel
// project on the owner's accounts, so it sits with the other build-grade tooling. Lower tiers get a
// 403 with the upgrade path.

import { createClient } from "@/lib/supabase/server";
import { getCurrentTier, tierAllowsLandingPageBuilder } from "@/lib/personas/tier-caps";
import { createPage, listPages, toView } from "@/lib/landing-pages/pages";
import { getTemplate } from "@/lib/landing-pages/templates";
import { isTemplateId } from "@/lib/landing-pages/types";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(4000),
  template: z.string().refine(isTemplateId, "Unknown template"),
  projectId: z.string().uuid().optional(),
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
  if (!getTemplate(parsed.data.template)) {
    return NextResponse.json({ error: "Unknown template" }, { status: 422 });
  }

  const created = await createPage({
    ownerId: user.id,
    title: parsed.data.title,
    description: parsed.data.description,
    template: parsed.data.template,
    projectId: parsed.data.projectId ?? null,
  });
  if (!created.ok) return NextResponse.json({ error: created.error }, { status: created.status });
  return NextResponse.json({ page: toView(created.data) }, { status: 201 });
}
