import { createClient } from "@/lib/supabase/server";
import { getCurrentTier } from "@/lib/personas/tier-caps";
import { tierAllowsLinkedinScout } from "@/lib/linkedin-scout/gate";
import { runEnrichmentSearch } from "@/lib/linkedin-scout/search";
import { createRun } from "@/lib/linkedin-scout/db";
import { SearchParamsSchema } from "@/lib/linkedin-scout/types";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/app/apps/linkedin-scout/search
// Run the enrichment search across the owner's configured sources, fit-score + rank the candidates,
// persist the run, and return the ranked list. Gated on tier (Pro+ and up, SPEC §6). Never queues
// anything — the owner shortlists a subset next.
export async function POST(req: Request): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raw = await req.json().catch(() => null);
  const parsed = SearchParamsSchema.safeParse(raw ?? {});
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 422 });

  const tier = await getCurrentTier(user.id);
  if (!tierAllowsLinkedinScout(tier)) {
    return NextResponse.json(
      {
        error: "upgrade_required",
        message:
          "LinkedIn Scout unlocks on Pro+. Upgrade to research LinkedIn prospects and stage the outreach for one-tap approval.",
      },
      { status: 402 },
    );
  }

  const limit = Math.min(parsed.data.limit ?? 25, 100);
  const outcome = await runEnrichmentSearch(parsed.data, limit);

  if (outcome.noSourcesConfigured) {
    return NextResponse.json(
      {
        candidates: [],
        noSourcesConfigured: true,
        message:
          "Connect an enrichment source (Apollo, Clay, or Common Room) to search LinkedIn. LinkedIn Scout never scrapes — it reads the paid APIs you already pay for.",
      },
      { status: 200 },
    );
  }

  // Persist the run so the shortlist step can reference it (and so cost/usage attribute to a run).
  const run = await createRun({
    ownerId: user.id,
    searchParams: parsed.data,
    candidateCount: outcome.candidates.length,
  });
  if (!run.ok) return NextResponse.json({ error: run.error }, { status: run.status });

  return NextResponse.json({
    runId: run.data.id,
    candidateCount: outcome.candidates.length,
    sourcesRun: outcome.sourcesRun,
    sourceErrors: outcome.sourceErrors,
    candidates: outcome.candidates.map((c) => ({
      linkedinProfileUrl: c.linkedinProfileUrl,
      fullName: c.fullName,
      headline: c.headline,
      company: c.company,
      fitScore: c.fitScore,
      enrichmentSource: c.enrichmentSource,
      // The snapshot the shortlist step will carry back (signals + raw), so we don't re-run the search.
      enrichmentSnapshot: { signals: c.signals, raw: c.raw },
    })),
  });
}
