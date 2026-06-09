import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { createMapsSourceWithProject } from "@/lib/leads/source";
import { runMapsSweep } from "@/lib/leads/google-maps-sweep";
import { getPack, packToMapsConfig } from "@/lib/leads/packs";
import { resolveBrightData } from "@/lib/pa-lead-scout-connections";
import { getCurrentTier, tierAllowsLeadScoutPacks } from "@/lib/personas/tier-caps";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Only `location` is read from the body — the owner is always the session user, never a client-
// supplied owner_id, so a subscribe can't be pointed at someone else's account.
const bodySchema = z.object({
  location: z.string().min(2).max(160),
});

// POST /api/app/apps/lead-scout/packs/[vertical]/subscribe
// Subscribe to a vertical pack (Phase 4): create a pre-configured Google Maps Lead Source from the
// pack, then auto-run its first sweep + stage the Mission Control batch card. Studio+/Enterprise only.
export async function POST(
  req: Request,
  { params }: { params: { vertical: string } },
): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pack = getPack(params.vertical);
  if (!pack) return NextResponse.json({ error: "Unknown pack" }, { status: 404 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Tell PA where to look — a city or area, like \"Knoxville, TN\"." },
      { status: 422 },
    );
  }
  const location = parsed.data.location.trim();

  // Tier gate (PA-LS-11): packs are a Studio+/Enterprise add-on. Lower tiers can browse the grid but
  // can't subscribe — the UI shows them the upgrade CTA; this is the server-side enforcement.
  const tier = await getCurrentTier(user.id);
  if (!tierAllowsLeadScoutPacks(tier)) {
    return NextResponse.json(
      {
        error: "upgrade_required",
        message: "Lead Scout packs are a Studio+ feature. Upgrade to subscribe and PA runs the full sweep for you.",
      },
      { status: 403 },
    );
  }

  // Create the pre-configured source + its backing Project, stamped with the pack slug.
  const config = packToMapsConfig(pack, location);
  const created = await createMapsSourceWithProject({
    ownerId: user.id,
    name: `${pack.name} — ${location}`,
    config,
    schedule: "weekly", // a pack is a subscription — the weekly cron keeps leads + drafts coming.
    packSlug: pack.vertical_slug,
  });
  if (!created.ok) return NextResponse.json({ error: created.error }, { status: created.status });
  const source = created.data;

  // Auto-run the first sweep. If Bright Data or the Anthropic key isn't set up yet, the source still
  // exists — return it with a needs_setup note so the owner can connect and run from the workspace.
  const brightData = await resolveBrightData(user.id);
  const paResult = await fetchPaUser(user.id);
  const paUser = paResult.ok ? paResult.data : null;

  if (!brightData.ok || !paUser || !paUser.anthropic_api_key) {
    const reason = !brightData.ok
      ? brightData.error
      : "Add your Anthropic API key in Settings — PA sorts each business by fit with it.";
    return NextResponse.json(
      {
        source,
        projectId: source.project_id,
        runStatus: "needs_setup",
        message: reason,
      },
      { status: 201 },
    );
  }

  const sweep = await runMapsSweep({
    source,
    config,
    ownerId: user.id,
    paUser,
    brightDataKey: brightData.apiKey,
    tier,
    framing: { packSlug: pack.vertical_slug, packName: pack.name, noun: pack.card_noun },
  });
  if (!sweep.ok) {
    // The source is saved; only the first sweep failed. Surface it but still hand back the source so
    // the owner lands in the workspace and can retry "Run now".
    return NextResponse.json(
      { source, projectId: source.project_id, runStatus: "run_failed", message: sweep.error },
      { status: 201 },
    );
  }

  return NextResponse.json(
    { source, projectId: source.project_id, runStatus: "ran", run: sweep.run },
    { status: 201 },
  );
}
