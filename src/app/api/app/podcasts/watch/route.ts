// /api/app/podcasts/watch
//   GET  → { watches, suggestions, recentCount } for the watch UI (one round-trip).
//   POST → add a watch. Two shapes:
//            { ref, cadence, notesOnly?, allowLong? }            — a pasted Apple/RSS link
//            { show: {showId, feedUrl, ...}, cadence, ... }       — a pre-resolved suggestion/pack show
//          Either way it upserts on (owner_id, show_id) so a re-add re-activates the existing row.

import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { classifyPodcastUrl } from "@/lib/podcasts/detect";
import { resolveShowForWatch } from "@/lib/podcasts/feed-resolve";
import {
  createWatch,
  listWatches,
  type WatchAddedFrom,
  type WatchCadence,
  type WatchShow,
} from "@/lib/podcasts/watch";
import { suggestShows } from "@/lib/podcasts/suggest";
import { countRecentPodcastIngests } from "@/lib/podcasts/recent";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pa = await fetchPaUser(user.id);
  const repo = pa.ok && pa.data ? pa.data.brain_repo : null;
  const token = pa.ok && pa.data ? pa.data.github_token : null;

  const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [watches, suggestions, recentCount] = await Promise.all([
    listWatches(user.id),
    repo ? suggestShows(user.id, repo, token) : Promise.resolve([]),
    countRecentPodcastIngests(user.id, sinceIso),
  ]);

  return NextResponse.json({ watches, suggestions, recentCount });
}

const showSchema = z.object({
  showId: z.string().min(1).max(500),
  feedUrl: z.string().url().max(1000),
  podcastUrl: z.string().max(1000).optional().default(""),
  title: z.string().max(300).optional().default(""),
  artworkUrl: z.string().max(1000).optional().default(""),
});

const addSchema = z
  .object({
    ref: z.string().min(1).max(1000).optional(),
    show: showSchema.optional(),
    cadence: z.enum(["realtime", "daily", "weekly"]),
    notesOnly: z.boolean().optional().default(false),
    allowLong: z.boolean().optional().default(false),
    addedFrom: z.enum(["manual", "suggestion", "ingest_card", "pack"]).optional().default("manual"),
  })
  .refine((v) => Boolean(v.ref) !== Boolean(v.show), {
    message: "Provide exactly one of { ref } or { show }",
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
  const parsed = addSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Expected { ref | show, cadence, ... }" }, { status: 422 });
  }

  // Resolve the show: either from a pre-resolved suggestion/pack payload, or by resolving a pasted link.
  let show: WatchShow;
  if (parsed.data.show) {
    const s = parsed.data.show;
    show = {
      showId: s.showId,
      feedUrl: s.feedUrl,
      podcastUrl: s.podcastUrl || s.feedUrl,
      title: s.title || "Untitled show",
      artworkUrl: s.artworkUrl,
    };
  } else {
    const ref = classifyPodcastUrl(parsed.data.ref ?? "");
    if (!ref) {
      return NextResponse.json(
        { error: "That doesn't look like a podcast link. Paste an Apple Podcasts page or an RSS feed URL." },
        { status: 422 },
      );
    }
    const resolved = await resolveShowForWatch(ref);
    if (!resolved.ok) return NextResponse.json({ error: resolved.message }, { status: 422 });
    show = resolved.show;
  }

  const created = await createWatch({
    ownerId: user.id,
    show,
    cadence: parsed.data.cadence as WatchCadence,
    notesOnly: parsed.data.notesOnly,
    allowLong: parsed.data.allowLong,
    addedFrom: parsed.data.addedFrom as WatchAddedFrom,
    nowIso: new Date().toISOString(),
  });
  if (!created.ok) return NextResponse.json({ error: created.error }, { status: 502 });

  return NextResponse.json({ ok: true, watch: created.data });
}
