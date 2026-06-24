// db.ts — data layer for pa_pocket_capture_reminders (service-role REST, no SDK — standing rule).
//
// Four write paths and two reads:
//   insertReminder        — the webhook schedules a parsed reminder.
//   listDueReminders      — the cron picks up pending reminders whose time has arrived (retry_count
//                           still under the cap), self-contained (deliver_to / deliver_from inline).
//   markReminderDelivered — the cron flips a row delivered after the SMS sends.
//   bumpReminderRetry     — a failed send increments retry_count but keeps the row pending to retry.
//   markReminderFailed    — at the retry cap the row is parked 'failed' and no longer swept.
//   listRecentReminders   — the dashboard feed (last N for an owner).
//   fetchOwnerAnthropicKey — the per-owner key the parser needs (the webhook's CaptureOwner omits it).

import { paEnv, authHeaders } from "../supabase";

const TABLE = "pa_pocket_capture_reminders";

// PC-CORE-5: a reminder's outbound SMS is retried at most this many times before it's parked failed.
export const MAX_RETRIES = 5;

type PaResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

export type ReminderRow = {
  id: string;
  task_text: string;
  source_text: string;
  remind_at: string;
  created_at: string;
  delivered_at: string | null;
  delivery_status: "pending" | "delivered" | "failed" | "cancelled";
  delivery_error: string | null;
  retry_count: number;
};

/** A due reminder the cron sends — carries the delivery addresses so the sweep needs no joins. */
export type DueReminder = {
  id: string;
  task_text: string;
  created_at: string;
  retry_count: number;
  deliver_to: string;
  deliver_from: string;
};

/** Schedule a parsed reminder. Returns the new row id. */
export async function insertReminder(params: {
  ownerId: string;
  originalCaptureId: string | null;
  taskText: string;
  remindAt: Date;
  sourceText: string;
  deliverTo: string;
  deliverFrom: string;
}): Promise<PaResult<{ id: string }>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(`${env.url}/rest/v1/${TABLE}`, {
    method: "POST",
    headers: { ...authHeaders(env.key), "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({
      owner_id: params.ownerId,
      original_capture_id: params.originalCaptureId,
      task_text: params.taskText.slice(0, 2000),
      remind_at: params.remindAt.toISOString(),
      source_text: params.sourceText.slice(0, 8000),
      deliver_to: params.deliverTo.slice(0, 40),
      deliver_from: params.deliverFrom.slice(0, 40),
    }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as { id: string }[];
  if (!rows[0]) return { ok: false, status: 500, error: "No row returned after reminder insert." };
  return { ok: true, data: { id: rows[0].id } };
}

/**
 * Pending reminders whose time has arrived and that still have retries left. Ordered by remind_at so
 * the most-overdue go first under a limit. The retry_count filter keeps a permanently-failing send
 * (dead number) from monopolising every sweep.
 */
export async function listDueReminders(nowIso: string, limit = 100): Promise<PaResult<DueReminder[]>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}` +
      `?delivery_status=eq.pending` +
      `&remind_at=lte.${encodeURIComponent(nowIso)}` +
      `&retry_count=lt.${MAX_RETRIES}` +
      `&select=id,task_text,created_at,retry_count,deliver_to,deliver_from` +
      `&order=remind_at.asc&limit=${limit}`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: (await res.json()) as DueReminder[] };
}

/** Flip a reminder delivered after its SMS sent. */
export async function markReminderDelivered(id: string, deliveredAtIso: string): Promise<PaResult<void>> {
  return patchRow(id, {
    delivery_status: "delivered",
    delivered_at: deliveredAtIso,
    delivery_error: null,
  });
}

/** A failed send: keep the row pending, record the error, bump the retry count. */
export async function bumpReminderRetry(id: string, error: string, retryCount: number): Promise<PaResult<void>> {
  return patchRow(id, {
    delivery_status: "pending",
    delivery_error: error.slice(0, 2000),
    retry_count: retryCount,
  });
}

/** Park a reminder failed once it has exhausted its retries. */
export async function markReminderFailed(id: string, error: string, retryCount: number): Promise<PaResult<void>> {
  return patchRow(id, {
    delivery_status: "failed",
    delivery_error: error.slice(0, 2000),
    retry_count: retryCount,
  });
}

/** The dashboard feed: an owner's most recent reminders, newest-first. */
export async function listRecentReminders(ownerId: string, limit = 50): Promise<PaResult<ReminderRow[]>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}` +
      `?owner_id=eq.${encodeURIComponent(ownerId)}` +
      `&select=id,task_text,source_text,remind_at,created_at,delivered_at,delivery_status,delivery_error,retry_count` +
      `&order=created_at.desc&limit=${limit}`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: (await res.json()) as ReminderRow[] };
}

/**
 * The owner's Anthropic API key (the parser needs it; the webhook's CaptureOwner shape omits it).
 * Returns null when the owner has no key set, so the parser degrades to a normal capture.
 */
export async function fetchOwnerAnthropicKey(ownerId: string): Promise<string | null> {
  const env = paEnv();
  if ("error" in env) return null;

  const res = await fetch(
    `${env.url}/rest/v1/pocket_agent_users` +
      `?id=eq.${encodeURIComponent(ownerId)}&select=anthropic_api_key&limit=1`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return null;
  const rows = (await res.json()) as { anthropic_api_key: string | null }[];
  return rows[0]?.anthropic_api_key ?? null;
}

async function patchRow(id: string, patch: Record<string, unknown>): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(`${env.url}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { ...authHeaders(env.key), "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(patch),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}
