// /api/app/youtube/watch
//   GET  → { watches, suggestions, recentCount } for the watch UI (one round-trip).
//   POST → add a watch. Body: { ref: string (URL/handle/channelId), cadence, addedFrom }.
//          Resolves the channel via the Data API, then upserts the watch (re-add re-activates).

import { createClient } from "@/lib/supabase/server";
import { resolveChannel } from "@/lib/youtube/channel-resolve";
import { createWatch, listWatches, type WatchCadence, type WatchAddedFrom } from "@/lib/youtube/watch";
import { suggestChannels } from "@/lib/youtube/suggest";
import { countRecentYouTubeIngests } from "@/lib/youtube/recent";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [watches, suggestions, recentCount] = await Promise.all([
    listWatches(user.id),
    suggestChannels(user.id),
    countRecentYouTubeIngests(user.id, sinceIso),
  ]);

  return NextResponse.json({ watches, suggestions, recentCount });
}

const addSchema = z.object({
  ref: z.string().min(1).max(500),
  cadence: z.enum(["realtime", "daily", "weekly"]),
  addedFrom: z.enum(["manual", "suggestion", "ingest_card"]).optional().default("manual"),
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
    return NextResponse.json({ error: "Expected { ref, cadence, addedFrom? }" }, { status: 422 });
  }

  const resolved = await resolveChannel(parsed.data.ref, process.env.YOUTUBE_API_KEY ?? null);
  if (!resolved.ok) {
    const status = resolved.reason === "no_key" ? 503 : resolved.reason === "bad_input" ? 422 : 404;
    return NextResponse.json({ error: resolved.message }, { status });
  }

  const created = await createWatch({
    ownerId: user.id,
    channel: resolved.channel,
    cadence: parsed.data.cadence as WatchCadence,
    addedFrom: parsed.data.addedFrom as WatchAddedFrom,
    nowIso: new Date().toISOString(),
  });
  if (!created.ok) return NextResponse.json({ error: created.error }, { status: 502 });

  return NextResponse.json({ ok: true, watch: created.data });
}
