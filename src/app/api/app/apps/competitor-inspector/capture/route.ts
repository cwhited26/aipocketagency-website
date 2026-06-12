// POST /api/app/apps/competitor-inspector/capture  { url, note? }
// Runs the headless extraction synchronously (the client holds the request open; maxDuration
// covers the worker's hard deadline), generates the profile, and stages the brain commit as a
// Mission Control approval card. Tier-gated Pro+ (PA-CINS).

import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { getCurrentTier, tierAllowsCompetitorInspector } from "@/lib/personas/tier-caps";
import { captureCompetitor } from "@/lib/competitor-inspector/capture";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BodySchema = z.object({
  url: z.string().min(4).max(2000),
  note: z.string().max(2000).optional(),
});

export async function POST(req: Request): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter the competitor's web address." }, { status: 400 });
  }

  const tier = await getCurrentTier(user.id);
  if (!tierAllowsCompetitorInspector(tier)) {
    return NextResponse.json(
      { error: "Competitor Inspector is part of Pro+ and above. Upgrade to run captures." },
      { status: 403 },
    );
  }

  const paResult = await fetchPaUser(user.id);
  if (!paResult.ok || !paResult.data) {
    return NextResponse.json({ error: "Finish onboarding first." }, { status: 409 });
  }

  const outcome = await captureCompetitor({
    ownerId: user.id,
    url: parsed.data.url,
    note: parsed.data.note?.trim() ? parsed.data.note.trim() : null,
    anthropicApiKey: paResult.data.anthropic_api_key,
  });

  if (!outcome.ok) {
    return NextResponse.json(
      { error: outcome.error, extractionId: outcome.extractionId ?? null },
      { status: 502 },
    );
  }

  return NextResponse.json({
    extractionId: outcome.extractionId,
    profilePath: outcome.profilePath,
    inboxItemId: outcome.inboxItemId,
  });
}
