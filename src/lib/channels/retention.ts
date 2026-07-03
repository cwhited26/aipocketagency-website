// lib/channels/retention.ts — the 30-day retention sweep for pa_channel_messages (PA-CHAN-3).
// Migration 074's retention plan: the verbatim provider payload (raw_payload) is kept 30 days for
// forensics, then NULLed. The message row itself — direction, body, thread, cost_event_id — stays
// for the owner's audit trail; only the raw provider payload is pruned. The sweep is one filtered
// PostgREST PATCH riding the partial index pa_channel_messages_retention_idx (created_at WHERE
// raw_payload IS NOT NULL), so re-runs match zero rows and the sweep is naturally idempotent.
// Service-role REST, no SDK — same posture as store.ts.

import { channelLog } from "./log";

export const CHANNEL_MESSAGE_RETENTION_DAYS = 30;

const MESSAGES_TABLE = "pa_channel_messages";

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

/** The ISO instant before which a message's raw_payload is past retention. */
export function retentionCutoffIso(now: Date): string {
  return new Date(now.getTime() - CHANNEL_MESSAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export type RetentionSweepResult =
  | { ok: true; swept: number; cutoff: string }
  | { ok: false; status: number; error: string };

/**
 * Null the raw_payload of every channel message older than the retention window. Returns how many
 * rows were swept this run (0 on a re-run — the filter excludes already-nulled payloads).
 */
export async function sweepChannelMessageRetention(
  now: Date = new Date(),
): Promise<RetentionSweepResult> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const cutoff = retentionCutoffIso(now);
  const endpoint =
    `${env.url}/rest/v1/${MESSAGES_TABLE}` +
    `?raw_payload=not.is.null` +
    `&created_at=lt.${encodeURIComponent(cutoff)}` +
    `&select=id`;
  const res = await fetch(endpoint, {
    method: "PATCH",
    headers: {
      apikey: env.key,
      Authorization: `Bearer ${env.key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ raw_payload: null }),
    cache: "no-store",
  });
  if (!res.ok) {
    const error = await res.text();
    channelLog.error("retention sweep PATCH failed", { status: res.status, error });
    return { ok: false, status: res.status, error };
  }
  const rows = (await res.json()) as Array<{ id: string }>;
  return { ok: true, swept: rows.length, cutoff };
}
