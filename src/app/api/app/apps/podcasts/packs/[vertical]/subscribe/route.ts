// POST /api/app/apps/podcasts/packs/[vertical]/subscribe
// Subscribe to a vertical curation pack (Phase 4): create a watch for every show in the pack, stamped
// with the pack slug, then write one zero-cost subscription_started audit event. Studio+/Enterprise
// only — the tier gate here is the server-side enforcement; the UI shows lower tiers the upgrade CTA.

import { createClient } from "@/lib/supabase/server";
import { getPodcastPack } from "@/lib/podcasts/packs";
import { createWatch, type WatchCadence } from "@/lib/podcasts/watch";
import { logPackSubscriptionAudit } from "@/lib/podcasts/pack-audit";
import { getCurrentTier, tierAllowsPodcastPacks } from "@/lib/personas/tier-caps";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Optional overrides — the owner can pick a cadence and notes-only at subscribe time; otherwise the
// pack's defaults apply. The owner is always the session user (never a client-supplied id).
const bodySchema = z.object({
  cadence: z.enum(["realtime", "daily", "weekly"]).optional(),
  notesOnly: z.boolean().optional(),
});

export async function POST(req: Request, { params }: { params: { vertical: string } }): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pack = getPodcastPack(params.vertical);
  if (!pack) return NextResponse.json({ error: "Unknown pack" }, { status: 404 });

  let raw: unknown = {};
  try {
    raw = await req.json();
  } catch {
    // An empty body is fine — the pack defaults apply.
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Expected { cadence? notesOnly? }" }, { status: 422 });
  }

  // Tier gate (PA-PC-14): packs are a Studio+/Enterprise add-on.
  const tier = await getCurrentTier(user.id);
  if (!tierAllowsPodcastPacks(tier)) {
    return NextResponse.json(
      {
        error: "upgrade_required",
        message: "Podcast packs are a Studio+ feature. Upgrade to follow a whole vertical's shows in one tap.",
      },
      { status: 403 },
    );
  }

  const cadence = (parsed.data.cadence ?? pack.default_cadence) as WatchCadence;
  const notesOnly = parsed.data.notesOnly ?? pack.notes_only_default;
  const nowIso = new Date().toISOString();

  let subscribed = 0;
  const failures: string[] = [];
  for (const show of pack.shows) {
    const created = await createWatch({
      ownerId: user.id,
      show: {
        showId: show.show_id,
        feedUrl: show.feed_url,
        podcastUrl: show.apple_url || show.feed_url,
        title: show.title,
        artworkUrl: "",
      },
      cadence,
      notesOnly,
      allowLong: false,
      addedFrom: "pack",
      packSlug: pack.vertical_slug,
      nowIso,
    });
    if (created.ok) subscribed++;
    else failures.push(`${show.title}: ${created.error}`);
  }

  // One zero-cost audit event for the subscription (the per-episode model cost lands later, per ingest).
  await logPackSubscriptionAudit({ ownerId: user.id, packSlug: pack.vertical_slug, showCount: subscribed });

  return NextResponse.json(
    { ok: true, pack: pack.vertical_slug, subscribed, total: pack.shows.length, failures },
    { status: 201 },
  );
}
