import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { getSource } from "@/lib/leads/source";
import { resolveBrightData } from "@/lib/pa-lead-scout-connections";
import { getCurrentTier } from "@/lib/personas/tier-caps";
import { screenUrlList } from "@/lib/leads/denylist";
import { runScout } from "@/lib/leads/scout";
import { runMapsSweep } from "@/lib/leads/google-maps-sweep";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Optionally scrape a one-off URL list passed in the body; otherwise the source's saved seed list.
const bodySchema = z.object({
  urls: z.array(z.string().max(2000)).max(2000).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Body is optional.
  let body: z.infer<typeof bodySchema> = {};
  const raw = await req.json().catch(() => null);
  if (raw !== null) {
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 422 });
    body = parsed.data;
  }

  const sourceResult = await getSource(params.id, user.id);
  if (!sourceResult.ok) {
    return NextResponse.json({ error: sourceResult.error }, { status: sourceResult.status });
  }
  const source = sourceResult.data;
  if (!source) return NextResponse.json({ error: "Lead Source not found" }, { status: 404 });

  // ── Google Maps sweep (Phase 2) ─────────────────────────────────────────────────────────────
  // A maps source has no URL list to screen — it reads Google's public local pack (PA-LS-5). Resolve
  // the Bright Data key + the owner's Anthropic key + tier and hand off to the sweep.
  if (source.kind === "google_maps") {
    if (!source.config_json) {
      return NextResponse.json(
        { error: "This Google Maps source has no criteria yet — edit it and set a category + location." },
        { status: 422 },
      );
    }
    const brightDataMaps = await resolveBrightData(user.id);
    if (!brightDataMaps.ok) {
      return NextResponse.json({ error: brightDataMaps.error }, { status: brightDataMaps.status });
    }
    const paMaps = await fetchPaUser(user.id);
    if (!paMaps.ok) return NextResponse.json({ error: paMaps.error }, { status: paMaps.status });
    if (!paMaps.data) return NextResponse.json({ error: "Account not found" }, { status: 404 });
    if (!paMaps.data.anthropic_api_key) {
      return NextResponse.json(
        {
          error: "no_api_key",
          message: "Add your Anthropic API key in Settings — Lead Scout uses it to sort each business by fit.",
        },
        { status: 402 },
      );
    }
    const sweep = await runMapsSweep({
      source,
      config: source.config_json,
      ownerId: user.id,
      paUser: paMaps.data,
      brightDataKey: brightDataMaps.apiKey,
      tier: await getCurrentTier(user.id),
    });
    if (!sweep.ok) return NextResponse.json({ error: sweep.error }, { status: sweep.status });
    return NextResponse.json({ run: sweep.run }, { status: 201 });
  }

  const inputUrls = body.urls ?? source.seed_urls;
  if (inputUrls.length === 0) {
    return NextResponse.json(
      { error: "This source has no URLs yet. Add a URL list before running it." },
      { status: 422 },
    );
  }

  // Resolve the Bright Data key (owner's own, or PA's shared account on Studio+).
  const brightData = await resolveBrightData(user.id);
  if (!brightData.ok) {
    return NextResponse.json({ error: brightData.error }, { status: brightData.status });
  }

  const paResult = await fetchPaUser(user.id);
  if (!paResult.ok) return NextResponse.json({ error: paResult.error }, { status: paResult.status });
  const paUser = paResult.data;
  if (!paUser) return NextResponse.json({ error: "Account not found" }, { status: 404 });
  if (!paUser.anthropic_api_key) {
    return NextResponse.json(
      {
        error: "no_api_key",
        message: "Add your Anthropic API key in Settings — Lead Scout uses it to read each page.",
      },
      { status: 402 },
    );
  }

  // Re-screen at run time (PA-LS-5): a URL that was clean at create time can later trip the denylist.
  // Trips become config_warnings on the run rather than silent skips; the rest get scraped.
  const { ok: cleanUrls, rejected } = screenUrlList(inputUrls);
  if (cleanUrls.length === 0) {
    return NextResponse.json(
      { error: "None of this source's URLs are scrapeable right now.", rejected },
      { status: 422 },
    );
  }

  const tier = await getCurrentTier(user.id);
  const isPaid = tier !== "starter";

  const scout = await runScout({
    source,
    ownerId: user.id,
    paUser,
    brightDataKey: brightData.apiKey,
    urls: cleanUrls,
    configWarnings: rejected.map((r) => ({ url: r.url, reason: r.reason })),
    isPaid,
  });
  if (!scout.ok) return NextResponse.json({ error: scout.error }, { status: scout.status });

  return NextResponse.json({ run: scout.run }, { status: 201 });
}
