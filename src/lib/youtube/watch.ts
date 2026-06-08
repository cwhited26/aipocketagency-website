// watch.ts — data layer for pa_youtube_watch (migration 043): the channels an owner asked PA to
// watch, on what cadence, and where each one last left off. Service-role REST, no SDK, typed —
// mirrors lib/youtube/log.ts. The cron (api/cron/youtube-watch) drives polling; the UI + API routes
// drive CRUD.

import type { ResolvedChannel } from "@/lib/youtube/channel-resolve";

export type WatchCadence = "realtime" | "daily" | "weekly";
export type WatchStatus = "active" | "paused" | "stopped";
export type WatchAddedFrom = "manual" | "suggestion" | "ingest_card";

/** Consecutive RSS failures after which a watch auto-pauses (PA-YT safety). */
export const WATCH_ERROR_AUTOPAUSE = 5;

const TABLE = "pa_youtube_watch";

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
  channelId: string;
  channelHandle: string;
  displayName: string;
  avatarUrl: string;
  cadence: WatchCadence;
  lastVideoId: string | null;
  lastVideoPublishedAt: string | null;
  lastPolledAt: string | null;
  nextPollAt: string | null;
  status: WatchStatus;
  errorCount: number;
  addedFrom: WatchAddedFrom;
};

type WatchDbRow = {
  id: string;
  owner_id: string;
  channel_id: string;
  channel_handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
  cadence: WatchCadence;
  last_video_id: string | null;
  last_video_published_at: string | null;
  last_polled_at: string | null;
  next_poll_at: string | null;
  status: WatchStatus;
  error_count: number | null;
  added_from: WatchAddedFrom;
};

function mapRow(r: WatchDbRow): Watch {
  return {
    id: r.id,
    channelId: r.channel_id,
    channelHandle: r.channel_handle ?? "",
    displayName: r.display_name ?? "Unknown channel",
    avatarUrl: r.avatar_url ?? "",
    cadence: r.cadence,
    lastVideoId: r.last_video_id,
    lastVideoPublishedAt: r.last_video_published_at,
    lastPolledAt: r.last_polled_at,
    nextPollAt: r.next_poll_at,
    status: r.status,
    errorCount: r.error_count ?? 0,
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

/**
 * Adds (or re-activates) a watch for a channel. Upserts on (owner_id, channel_id) so the same
 * channel can't be double-watched; a re-add flips a stopped/paused watch back to active. The first
 * poll is scheduled immediately (next_poll_at = now) so the owner sees it work right away.
 */
export async function createWatch(params: {
  ownerId: string;
  channel: ResolvedChannel;
  cadence: WatchCadence;
  addedFrom: WatchAddedFrom;
  nowIso: string;
}): Promise<WatchResult<Watch>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, error: env.error };

  const body = {
    owner_id: params.ownerId,
    channel_id: params.channel.channelId,
    channel_handle: params.channel.handle,
    display_name: params.channel.displayName,
    avatar_url: params.channel.avatarUrl,
    cadence: params.cadence,
    status: "active" as WatchStatus,
    error_count: 0,
    next_poll_at: params.nowIso,
    added_from: params.addedFrom,
  };

  let res: Response;
  try {
    res = await fetch(`${env.url}/rest/v1/${TABLE}?on_conflict=owner_id,channel_id`, {
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

/** Lists an owner's non-stopped watches, newest-added first. */
export async function listWatches(ownerId: string): Promise<Watch[]> {
  const env = paEnv();
  if ("error" in env) return [];
  const params = new URLSearchParams({
    owner_id: `eq.${ownerId}`,
    status: "neq.stopped",
    order: "added_at.desc",
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

/** Returns the set of channel ids the owner already watches (for filtering suggestions). */
export async function watchedChannelIds(ownerId: string): Promise<Set<string>> {
  const watches = await listWatches(ownerId);
  return new Set(watches.map((w) => w.channelId));
}

async function patchWatch(
  ownerId: string,
  watchId: string,
  patch: Record<string, unknown>,
): Promise<WatchResult<Watch>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, error: env.error };
  const params = new URLSearchParams({
    id: `eq.${watchId}`,
    owner_id: `eq.${ownerId}`,
  });
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

/** Pause / resume / stop a watch (owner-scoped). Resume schedules an immediate poll. */
export async function setWatchStatus(
  ownerId: string,
  watchId: string,
  status: WatchStatus,
  nowIso: string,
): Promise<WatchResult<Watch>> {
  const patch: Record<string, unknown> = { status };
  if (status === "active") {
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

/** All active watches whose next poll is due (service-role; across owners — the cron iterates these). */
export async function fetchDueWatches(nowIso: string): Promise<WatchDbRow[]> {
  const env = paEnv();
  if ("error" in env) return [];
  const params = new URLSearchParams({
    status: "eq.active",
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

/** Re-export the raw row type the cron iterates over fetchDueWatches results. */
export type WatchPollRow = WatchDbRow;

/** Marks a successful poll: advance the cursor + reschedule + clear the error streak (service-role). */
export async function markWatchPolled(
  watchId: string,
  params: { lastVideoId: string | null; lastPublishedAt: string | null; cadence: WatchCadence; nowIso: string },
): Promise<void> {
  const env = paEnv();
  if ("error" in env) return;
  const patch: Record<string, unknown> = {
    last_polled_at: params.nowIso,
    next_poll_at: nextPollFrom(params.cadence, Date.parse(params.nowIso)),
    error_count: 0,
  };
  if (params.lastVideoId) patch.last_video_id = params.lastVideoId;
  if (params.lastPublishedAt) patch.last_video_published_at = params.lastPublishedAt;
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
export async function recordWatchPollError(
  row: WatchPollRow,
  nowIso: string,
): Promise<void> {
  const env = paEnv();
  if ("error" in env) return;
  const nextCount = (row.error_count ?? 0) + 1;
  const patch: Record<string, unknown> = {
    error_count: nextCount,
    last_polled_at: nowIso,
    next_poll_at: nextPollFrom(row.cadence, Date.parse(nowIso)),
  };
  if (nextCount >= WATCH_ERROR_AUTOPAUSE) patch.status = "paused";
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
