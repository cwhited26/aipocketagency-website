// watch.ts — data layer for pa_podcast_watch (migration 061): the shows an owner asked PA to follow,
// on what cadence, in which mode (full transcript vs the cheap notes-only pass), and where each one
// last left off. Service-role REST, no SDK, typed — mirrors lib/youtube/watch.ts. The cron
// (api/cron/podcast-watch) drives polling; the UI + API routes drive CRUD.
//
// "Stop watching" deletes the row; pause/resume toggles `paused`. A re-add upserts on (owner_id,
// show_id) so a show can't be double-watched and a re-add un-pauses the existing row.

import type { PodcastEpisode } from "./rss-parser";

export type WatchCadence = "realtime" | "daily" | "weekly";
export type WatchAddedFrom = "manual" | "suggestion" | "ingest_card" | "pack";

/** Consecutive RSS failures after which a watch auto-pauses (the YouTube-watch safety, PA-PC-9). */
export const WATCH_ERROR_AUTOPAUSE = 5;

const TABLE = "pa_podcast_watch";

function paEnv(): { url: string; key: string } | { error: string } {
  const url =
    process.env.POCKET_AGENT_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.WC_ADMIN_SUPABASE_URL;
  const key =
    process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.WC_ADMIN_SUPABASE_SERVICE_KEY;
  if (!url || !key) return { error: "Supabase service-role env vars not set" };
  return { url: url.replace(/\/$/, ""), key };
}

function headers(key: string, extra?: Record<string, string>): Record<string, string> {
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...extra };
}

export type Watch = {
  id: string;
  showId: string;
  podcastUrl: string;
  podcastTitle: string;
  feedUrl: string;
  artworkUrl: string;
  cadence: WatchCadence;
  notesOnlyMode: boolean;
  allowLong: boolean;
  paused: boolean;
  errorCount: number;
  lastEpisodeGuid: string | null;
  lastEpisodePubAt: string | null;
  packSlug: string | null;
  addedFrom: WatchAddedFrom;
};

type WatchDbRow = {
  id: string;
  owner_id: string;
  show_id: string;
  podcast_url: string | null;
  podcast_title: string | null;
  feed_url: string;
  artwork_url: string | null;
  cadence: WatchCadence;
  notes_only_mode: boolean | null;
  allow_long: boolean | null;
  paused: boolean | null;
  error_count: number | null;
  last_episode_guid: string | null;
  last_episode_pub_at: string | null;
  next_poll_at: string | null;
  pack_slug: string | null;
  added_from: WatchAddedFrom;
};

function mapRow(r: WatchDbRow): Watch {
  return {
    id: r.id,
    showId: r.show_id,
    podcastUrl: r.podcast_url ?? "",
    podcastTitle: r.podcast_title ?? "Unknown show",
    feedUrl: r.feed_url,
    artworkUrl: r.artwork_url ?? "",
    cadence: r.cadence,
    notesOnlyMode: r.notes_only_mode ?? false,
    allowLong: r.allow_long ?? false,
    paused: r.paused ?? false,
    errorCount: r.error_count ?? 0,
    lastEpisodeGuid: r.last_episode_guid,
    lastEpisodePubAt: r.last_episode_pub_at,
    packSlug: r.pack_slug,
    addedFrom: r.added_from,
  };
}

const CADENCE_MS: Record<WatchCadence, number> = {
  realtime: 15 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};

/** The next poll time for a cadence, measured from `fromMs`. */
export function nextPollFrom(cadence: WatchCadence, fromMs: number): string {
  return new Date(fromMs + CADENCE_MS[cadence]).toISOString();
}

type WatchResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** The resolved show identity a watch is created from (from feed-resolve + the parsed feed). */
export type WatchShow = {
  showId: string;
  feedUrl: string;
  podcastUrl: string;
  title: string;
  artworkUrl: string;
};

/**
 * Adds (or re-activates) a watch for a show. Upserts on (owner_id, show_id) so the same show can't be
 * double-watched; a re-add un-pauses the existing row and clears its error streak. The first poll is
 * scheduled immediately (next_poll_at = now) so the owner sees it work right away.
 */
export async function createWatch(params: {
  ownerId: string;
  show: WatchShow;
  cadence: WatchCadence;
  notesOnly: boolean;
  allowLong: boolean;
  addedFrom: WatchAddedFrom;
  packSlug?: string | null;
  nowIso: string;
}): Promise<WatchResult<Watch>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, error: env.error };

  const body = {
    owner_id: params.ownerId,
    show_id: params.show.showId,
    feed_url: params.show.feedUrl,
    podcast_url: params.show.podcastUrl,
    podcast_title: params.show.title,
    artwork_url: params.show.artworkUrl,
    cadence: params.cadence,
    notes_only_mode: params.notesOnly,
    allow_long: params.allowLong,
    paused: false,
    error_count: 0,
    next_poll_at: params.nowIso,
    pack_slug: params.packSlug ?? null,
    added_from: params.addedFrom,
  };

  let res: Response;
  try {
    res = await fetch(`${env.url}/rest/v1/${TABLE}?on_conflict=owner_id,show_id`, {
      method: "POST",
      headers: headers(env.key, { Prefer: "resolution=merge-duplicates,return=representation" }),
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "watch insert failed" };
  }
  if (!res.ok) return { ok: false, error: `watch insert returned ${res.status}` };
  const rows = (await res.json()) as WatchDbRow[];
  if (!rows[0]) return { ok: false, error: "watch insert returned no row" };
  return { ok: true, data: mapRow(rows[0]) };
}

/** Lists an owner's watches, newest-added first. */
export async function listWatches(ownerId: string): Promise<Watch[]> {
  const env = paEnv();
  if ("error" in env) return [];
  const params = new URLSearchParams({
    owner_id: `eq.${ownerId}`,
    order: "created_at.desc",
  });
  let res: Response;
  try {
    res = await fetch(`${env.url}/rest/v1/${TABLE}?${params.toString()}`, {
      headers: headers(env.key),
      cache: "no-store",
    });
  } catch {
    return [];
  }
  if (!res.ok) return [];
  const rows = (await res.json()) as WatchDbRow[];
  return rows.map(mapRow);
}

/** Returns the set of show ids the owner already watches (for filtering suggestions + pack state). */
export async function watchedShowIds(ownerId: string): Promise<Set<string>> {
  const watches = await listWatches(ownerId);
  return new Set(watches.map((w) => w.showId));
}

async function patchWatch(
  ownerId: string,
  watchId: string,
  patch: Record<string, unknown>,
): Promise<WatchResult<Watch>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, error: env.error };
  const params = new URLSearchParams({ id: `eq.${watchId}`, owner_id: `eq.${ownerId}` });
  let res: Response;
  try {
    res = await fetch(`${env.url}/rest/v1/${TABLE}?${params.toString()}`, {
      method: "PATCH",
      headers: headers(env.key, { Prefer: "return=representation" }),
      body: JSON.stringify(patch),
      cache: "no-store",
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "watch update failed" };
  }
  if (!res.ok) return { ok: false, error: `watch update returned ${res.status}` };
  const rows = (await res.json()) as WatchDbRow[];
  if (!rows[0]) return { ok: false, error: "watch not found" };
  return { ok: true, data: mapRow(rows[0]) };
}

/** Pause / resume a watch (owner-scoped). Resume clears the error streak + schedules an immediate poll. */
export async function setWatchPaused(
  ownerId: string,
  watchId: string,
  paused: boolean,
  nowIso: string,
): Promise<WatchResult<Watch>> {
  const patch: Record<string, unknown> = { paused };
  if (!paused) {
    patch.error_count = 0; // resuming clears the failure streak
    patch.next_poll_at = nowIso;
  }
  return patchWatch(ownerId, watchId, patch);
}

/** Change a watch's cadence and reschedule its next poll. */
export async function setWatchCadence(
  ownerId: string,
  watchId: string,
  cadence: WatchCadence,
  nowIso: string,
): Promise<WatchResult<Watch>> {
  return patchWatch(ownerId, watchId, {
    cadence,
    next_poll_at: nextPollFrom(cadence, Date.parse(nowIso)),
  });
}

/** Flip a watch between full-transcript and notes-only mode (PA-PC-5 cost discipline). */
export async function setWatchNotesOnly(
  ownerId: string,
  watchId: string,
  notesOnly: boolean,
): Promise<WatchResult<Watch>> {
  return patchWatch(ownerId, watchId, { notes_only_mode: notesOnly });
}

/** "Stop watching" — deletes the row (owner-scoped). */
export async function deleteWatch(ownerId: string, watchId: string): Promise<WatchResult<{ id: string }>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, error: env.error };
  const params = new URLSearchParams({ id: `eq.${watchId}`, owner_id: `eq.${ownerId}` });
  let res: Response;
  try {
    res = await fetch(`${env.url}/rest/v1/${TABLE}?${params.toString()}`, {
      method: "DELETE",
      headers: headers(env.key, { Prefer: "return=minimal" }),
      cache: "no-store",
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "watch delete failed" };
  }
  if (!res.ok) return { ok: false, error: `watch delete returned ${res.status}` };
  return { ok: true, data: { id: watchId } };
}

/** All un-paused watches whose next poll is due (service-role; across owners — the cron iterates these). */
export async function fetchDueWatches(nowIso: string): Promise<WatchDbRow[]> {
  const env = paEnv();
  if ("error" in env) return [];
  const params = new URLSearchParams({
    paused: "eq.false",
    next_poll_at: `lte.${nowIso}`,
    order: "next_poll_at.asc",
    limit: "200",
  });
  let res: Response;
  try {
    res = await fetch(`${env.url}/rest/v1/${TABLE}?${params.toString()}`, {
      headers: headers(env.key),
      cache: "no-store",
    });
  } catch {
    return [];
  }
  if (!res.ok) return [];
  return (await res.json()) as WatchDbRow[];
}

/** The raw row type the cron iterates over fetchDueWatches results. */
export type WatchPollRow = WatchDbRow;

/** Marks a successful poll: advance the cursor + reschedule + clear the error streak (service-role). */
export async function markWatchPolled(
  watchId: string,
  params: { lastEpisodeGuid: string | null; lastEpisodePubAt: string | null; cadence: WatchCadence; nowIso: string },
): Promise<void> {
  const env = paEnv();
  if ("error" in env) return;
  const patch: Record<string, unknown> = {
    last_poll_at: params.nowIso,
    next_poll_at: nextPollFrom(params.cadence, Date.parse(params.nowIso)),
    error_count: 0,
  };
  if (params.lastEpisodeGuid) patch.last_episode_guid = params.lastEpisodeGuid;
  if (params.lastEpisodePubAt) patch.last_episode_pub_at = params.lastEpisodePubAt;
  try {
    await fetch(`${env.url}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(watchId)}`, {
      method: "PATCH",
      headers: headers(env.key, { Prefer: "return=minimal" }),
      body: JSON.stringify(patch),
      cache: "no-store",
    });
  } catch {
    // A bookkeeping miss only means this watch re-polls next interval — not worth failing the cron.
  }
}

/** Records a poll failure: increment error_count, auto-pause once it hits WATCH_ERROR_AUTOPAUSE
 *  (service-role). Still reschedules the next poll so a transient blip retries. */
export async function recordWatchPollError(row: WatchPollRow, nowIso: string): Promise<void> {
  const env = paEnv();
  if ("error" in env) return;
  const nextCount = (row.error_count ?? 0) + 1;
  const patch: Record<string, unknown> = {
    error_count: nextCount,
    last_poll_at: nowIso,
    next_poll_at: nextPollFrom(row.cadence, Date.parse(nowIso)),
  };
  if (nextCount >= WATCH_ERROR_AUTOPAUSE) patch.paused = true;
  try {
    await fetch(`${env.url}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(row.id)}`, {
      method: "PATCH",
      headers: headers(env.key, { Prefer: "return=minimal" }),
      body: JSON.stringify(patch),
      cache: "no-store",
    });
  } catch {
    // See markWatchPolled — a bookkeeping miss is non-fatal.
  }
}

/**
 * Returns the episodes newer than `lastGuid`, newest-first. The feed is newest-first, so we take
 * episodes until we hit the last-seen guid. When lastGuid is null (first poll of a new watch) we
 * return only the most recent episode — so adding a watch doesn't backfill the whole back catalog.
 * Mirrors lib/youtube/rss-poller.ts newEntriesSince so both lanes agree on "what's new".
 */
export function newEpisodesSince(episodes: PodcastEpisode[], lastGuid: string | null): PodcastEpisode[] {
  if (episodes.length === 0) return [];
  if (!lastGuid) return [episodes[0]];
  const fresh: PodcastEpisode[] = [];
  for (const ep of episodes) {
    if (ep.guid === lastGuid) break;
    fresh.push(ep);
  }
  return fresh;
}
