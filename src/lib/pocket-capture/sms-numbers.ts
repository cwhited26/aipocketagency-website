// sms-numbers.ts — data layer for pa_pocket_capture_twilio_numbers (service-role REST, no SDK).
//
// Three concerns:
//   1. getActiveTwilioNumber — read an owner's current (not-yet-released) number. The idempotency
//      gate for provisioning: if this returns a row, we never buy a second number.
//   2. insertTwilioNumber — persist a freshly-bought number after the Twilio purchase succeeds.
//   3. lookupCaptureOwnerByTwilioNumber — resolve an inbound `To` number to the owning user plus
//      their brain credentials (the webhook's routing key). Joins the numbers table to
//      pocket_agent_users for brain_repo / github_token, reusing the CaptureOwner shape.

import { paEnv, authHeaders } from "./supabase";
import type { CaptureOwner } from "./slug";

const TABLE = "pa_pocket_capture_twilio_numbers";

type PaResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

export type ActiveTwilioNumber = { phoneNumber: string; phoneSid: string };

/** Read an owner's active (released_at IS NULL) Twilio number, or null when none is provisioned. */
export async function getActiveTwilioNumber(
  ownerId: string,
): Promise<PaResult<ActiveTwilioNumber | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}` +
      `?owner_id=eq.${encodeURIComponent(ownerId)}&released_at=is.null` +
      `&select=twilio_phone_number,twilio_phone_sid&limit=1`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as { twilio_phone_number: string; twilio_phone_sid: string }[];
  const row = rows[0];
  if (!row) return { ok: true, data: null };
  return { ok: true, data: { phoneNumber: row.twilio_phone_number, phoneSid: row.twilio_phone_sid } };
}

/**
 * Persist a freshly-purchased number. Tolerates the active-owner UNIQUE collision (a concurrent
 * provision that won the race) by reporting it as a duplicate so the caller re-reads the winner.
 */
export async function insertTwilioNumber(params: {
  ownerId: string;
  phoneNumber: string;
  phoneSid: string;
}): Promise<PaResult<{ duplicate: boolean }>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(`${env.url}/rest/v1/${TABLE}`, {
    method: "POST",
    headers: { ...authHeaders(env.key), "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({
      owner_id: params.ownerId,
      twilio_phone_number: params.phoneNumber,
      twilio_phone_sid: params.phoneSid,
    }),
    cache: "no-store",
  });
  if (res.ok) return { ok: true, data: { duplicate: false } };

  const body = await res.text();
  if (res.status === 409 || body.includes("23505") || body.includes("duplicate key")) {
    return { ok: true, data: { duplicate: true } };
  }
  return { ok: false, status: res.status, error: body };
}

/**
 * Resolve an inbound `To` number to the owning user + their brain credentials. Two reads: the
 * active numbers row gives the owner_id; pocket_agent_users gives brain_repo / github_token.
 * Returns null when the number isn't an active Pocket Capture number (the webhook audits + ignores).
 */
export async function lookupCaptureOwnerByTwilioNumber(
  toNumber: string,
): Promise<PaResult<CaptureOwner | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const numRes = await fetch(
    `${env.url}/rest/v1/${TABLE}` +
      `?twilio_phone_number=eq.${encodeURIComponent(toNumber)}&released_at=is.null` +
      `&select=owner_id&limit=1`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!numRes.ok) return { ok: false, status: numRes.status, error: await numRes.text() };
  const numRows = (await numRes.json()) as { owner_id: string }[];
  const ownerId = numRows[0]?.owner_id;
  if (!ownerId) return { ok: true, data: null };

  const userRes = await fetch(
    `${env.url}/rest/v1/pocket_agent_users` +
      `?id=eq.${encodeURIComponent(ownerId)}&select=id,brain_repo,github_token&limit=1`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!userRes.ok) return { ok: false, status: userRes.status, error: await userRes.text() };
  const userRows = (await userRes.json()) as CaptureOwner[];
  return { ok: true, data: userRows[0] ?? null };
}
