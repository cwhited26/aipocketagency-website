// GET /api/cron/podcast-watch  (Vercel Cron, every 15 minutes)
//
// Polls every watched show whose next_poll_at is due (one cron, all cadences — realtime/daily/weekly
// are encoded in next_poll_at, not separate schedules — the exact YouTube channel-watch pattern). For
// each due watch we fetch the show's RSS feed, detect episodes newer than the watch's cursor, and fan
// each new one through the Phase-1 ingester VERBATIM (resolve → Whisper or notes-only → classify →
// bucket brain note). Successful polls advance the cursor + reschedule; RSS failures bump error_count
// and auto-pause at 5. A feed hiccup on one show never aborts the sweep — it's logged on that row and
// retried next interval.

import { NextResponse } from "next/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import {
  fetchDueWatches,
  markWatchPolled,
  newEpisodesSince,
  recordWatchPollError,
  type WatchCadence,
  type WatchPollRow,
} from "@/lib/podcasts/watch";
import { fetchFeed } from "@/lib/podcasts/rss-parser";
import { ingestPodcastEpisode, type PodcastOwnerContext } from "@/lib/podcasts/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Bound cost: ingest at most this many new episodes per show per poll (a backstop against a show that
// dropped a burst, or a long-dormant watch). The cursor still advances to the newest episode.
const MAX_NEW_PER_POLL = 3;

export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nowIso = new Date().toISOString();
  const due = await fetchDueWatches(nowIso);

  // One brain context per owner across the sweep (null = owner can't ingest: no brain/key).
  const ctxByOwner = new Map<string, PodcastOwnerContext | null>();
  async function ownerCtx(ownerId: string): Promise<PodcastOwnerContext | null> {
    if (ctxByOwner.has(ownerId)) return ctxByOwner.get(ownerId) ?? null;
    const pa = await fetchPaUser(ownerId);
    let ctx: PodcastOwnerContext | null = null;
    if (pa.ok && pa.data?.brain_repo && pa.data.github_token) {
      ctx = {
        ownerId,
        repo: pa.data.brain_repo,
        token: pa.data.github_token,
        anthropicApiKey: pa.data.anthropic_api_key,
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
    const feed = await fetchFeed(row.feed_url);
    if (!feed.ok) {
      await recordWatchPollError(row, nowIso);
      failed++;
      continue;
    }

    const newest = feed.feed.episodes[0] ?? null;
    const fresh = newEpisodesSince(feed.feed.episodes, row.last_episode_guid);

    if (fresh.length > 0) {
      const ctx = await ownerCtx(row.owner_id);
      if (ctx) {
        // Ingest oldest-first so the brain notes land in chronological order.
        const toIngest = fresh.slice(0, MAX_NEW_PER_POLL).reverse();
        for (const ep of toIngest) {
          const result = await ingestPodcastEpisode({
            ref: { kind: "rss", url: row.feed_url },
            source: "watch",
            ctx,
            allowLong: row.allow_long ?? false,
            notesOnly: row.notes_only_mode ?? false,
            episodeGuid: ep.guid,
          });
          if (result.ok) ingested++;
        }
      }
    }

    await markWatchPolled(row.id, {
      lastEpisodeGuid: newest?.guid ?? row.last_episode_guid,
      lastEpisodePubAt: newest?.pubDateIso || null,
      cadence,
      nowIso,
    });
    polled++;
  }

  return NextResponse.json({ ok: true, due: due.length, polled, ingested, failed });
}
