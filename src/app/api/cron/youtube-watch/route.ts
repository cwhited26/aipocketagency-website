// GET /api/cron/youtube-watch  (Vercel Cron, every 15 minutes)
//
// Polls every watched channel whose next_poll_at is due (one cron, all cadences — realtime/daily/
// weekly are encoded in next_poll_at, not separate schedules). For each due watch we fetch the
// channel's free Atom feed, detect uploads newer than the watch's cursor, and fan each new video
// through the v1.0 ingester (transcript → metadata → classifier → bucket brain note). Successful
// polls advance the cursor + reschedule; RSS failures bump error_count and auto-pause at 5. A feed
// hiccup on one channel never aborts the sweep — it's logged on that row and retried next interval.

import { NextResponse } from "next/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import {
  fetchDueWatches,
  markWatchPolled,
  recordWatchPollError,
  type WatchPollRow,
  type WatchCadence,
} from "@/lib/youtube/watch";
import { fetchChannelFeed, newEntriesSince } from "@/lib/youtube/rss-poller";
import { ingestYouTubeVideo, type YouTubeOwnerContext } from "@/lib/youtube/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Bound cost: ingest at most this many new uploads per channel per poll (a backstop against a
// channel that posted a burst, or a long-dormant watch). The cursor still advances to newest.
const MAX_NEW_PER_POLL = 5;

export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nowIso = new Date().toISOString();
  const due = await fetchDueWatches(nowIso);

  // One brain context per owner across the sweep (null = owner can't ingest: no brain/key).
  const ctxByOwner = new Map<string, YouTubeOwnerContext | null>();
  async function ownerCtx(ownerId: string): Promise<YouTubeOwnerContext | null> {
    if (ctxByOwner.has(ownerId)) return ctxByOwner.get(ownerId) ?? null;
    const pa = await fetchPaUser(ownerId);
    let ctx: YouTubeOwnerContext | null = null;
    if (pa.ok && pa.data?.brain_repo && pa.data.github_token) {
      ctx = {
        ownerId,
        repo: pa.data.brain_repo,
        token: pa.data.github_token,
        anthropicApiKey: pa.data.anthropic_api_key,
        openaiApiKey: process.env.OPENAI_API_KEY ?? null,
      };
    }
    ctxByOwner.set(ownerId, ctx);
    return ctx;
  }

  let polled = 0;
  let ingested = 0;
  let failed = 0;

  for (const row of due as WatchPollRow[]) {
    const cadence = row.cadence as WatchCadence;
    const feed = await fetchChannelFeed(row.channel_id);
    if (!feed.ok) {
      await recordWatchPollError(row, nowIso);
      failed++;
      continue;
    }

    const newest = feed.entries[0] ?? null;
    const fresh = newEntriesSince(feed.entries, row.last_video_id);

    if (fresh.length > 0) {
      const ctx = await ownerCtx(row.owner_id);
      if (ctx) {
        // Ingest oldest-first so the brain notes land in chronological order.
        const toIngest = fresh.slice(0, MAX_NEW_PER_POLL).reverse();
        for (const entry of toIngest) {
          const result = await ingestYouTubeVideo({
            videoId: entry.videoId,
            source: "channel_watch",
            ctx,
            allowLong: false,
          });
          if (result.ok) ingested++;
        }
      }
    }

    await markWatchPolled(row.id, {
      lastVideoId: newest?.videoId ?? row.last_video_id,
      lastPublishedAt: newest?.published ?? null,
      cadence,
      nowIso,
    });
    polled++;
  }

  return NextResponse.json({ ok: true, due: due.length, polled, ingested, failed });
}
