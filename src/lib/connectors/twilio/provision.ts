// connectors/twilio/provision.ts — provision a dedicated Twilio number for a Pocket Capture owner
// and wire it at the SMS capture surface. Direct REST against the Twilio API, no SDK (standing
// rule). Reuses the platform Twilio account credentials from connectors/sms/config.ts.
//
// Twilio's IncomingPhoneNumbers POST accepts an AreaCode and searches+buys an SMS-capable number
// in one call, wiring its SmsUrl + VoiceUrl in the same request — so the number is capture-ready
// the moment it's owned. We persist (owner_id, number, sid) in pa_pocket_capture_twilio_numbers.
//
// Idempotent: an owner who already has an active number gets it back without a second purchase.

import { z } from "zod";
import { twilioConfig, twilioBasicAuth, twilioAccountBase } from "@/lib/connectors/sms/config";
import { captureSmsWebhookUrl, captureVoiceNoopUrl } from "./config";
import {
  getActiveTwilioNumber,
  insertTwilioNumber,
  type ActiveTwilioNumber,
} from "@/lib/pocket-capture/sms-numbers";

type ProvisionResult =
  | { ok: true; phoneNumber: string; phoneSid: string; existed: boolean }
  | { ok: false; status: number; error: string };

const IncomingNumberSchema = z.object({
  sid: z.string().min(1),
  phone_number: z.string().min(1),
});

/** Extract a 3-digit US area code from owner input, or null when it isn't a clean NPA. */
export function normalizeAreaCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 3) return digits;
  if (digits.length === 10) return digits.slice(0, 3);
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1, 4);
  return null;
}

/** Build the IncomingPhoneNumbers purchase body — wires both webhooks at buy time. */
export function buildPurchaseBody(areaCode: string | null): URLSearchParams {
  const body = new URLSearchParams({
    SmsUrl: captureSmsWebhookUrl(),
    SmsMethod: "POST",
    VoiceUrl: captureVoiceNoopUrl(),
    VoiceMethod: "POST",
  });
  // No AreaCode → Twilio buys from the national pool. With one, it scopes the search to that NPA.
  if (areaCode) body.set("AreaCode", areaCode);
  return body;
}

/**
 * Ensure the owner has a dedicated Pocket Capture Twilio number, provisioning one if absent.
 *
 *   - If an active number already exists → return it (existed: true), no purchase.
 *   - Otherwise buy an SMS-capable number (preferring `areaCode` when given), wire its SmsUrl to
 *     the capture webhook + VoiceUrl to the no-op, and persist it.
 *   - On the concurrent-provision race (two callers buy at once), the second insert collides on
 *     the active-owner UNIQUE index; we re-read and return the winner.
 *
 * Never throws — returns a typed failure. Returns status 501 when Twilio isn't configured so the
 * dashboard can show "SMS isn't available yet" instead of 500-ing.
 */
export async function provisionTwilioNumber(params: {
  ownerId: string;
  areaCode?: string | null;
}): Promise<ProvisionResult> {
  const existing = await getActiveTwilioNumber(params.ownerId);
  if (!existing.ok) return { ok: false, status: existing.status, error: existing.error };
  if (existing.data) {
    return { ok: true, phoneNumber: existing.data.phoneNumber, phoneSid: existing.data.phoneSid, existed: true };
  }

  const config = twilioConfig();
  if (!config) {
    return { ok: false, status: 501, error: "Twilio is not configured (no account SID / auth token)." };
  }

  const areaCode = normalizeAreaCode(params.areaCode);
  let res: Response;
  try {
    res = await fetch(`${twilioAccountBase(config)}/IncomingPhoneNumbers.json`, {
      method: "POST",
      headers: {
        Authorization: twilioBasicAuth(config),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: buildPurchaseBody(areaCode).toString(),
      cache: "no-store",
    });
  } catch (e) {
    return { ok: false, status: 502, error: e instanceof Error ? e.message : "Twilio purchase failed." };
  }
  if (!res.ok) {
    return { ok: false, status: res.status, error: await res.text() };
  }
  const parsed = IncomingNumberSchema.safeParse(await res.json().catch(() => null));
  if (!parsed.success) {
    return { ok: false, status: 502, error: "Twilio returned an unexpected provision response." };
  }
  const bought = parsed.data;

  const inserted = await insertTwilioNumber({
    ownerId: params.ownerId,
    phoneNumber: bought.phone_number,
    phoneSid: bought.sid,
  });
  if (!inserted.ok) return { ok: false, status: inserted.status, error: inserted.error };

  // Lost the race — another provision persisted first. Return that winner so we never report a
  // number we bought but couldn't store as the owner's. (The orphaned purchase is logged upstream.)
  if (inserted.data.duplicate) {
    const winner = await getActiveTwilioNumber(params.ownerId);
    if (winner.ok && winner.data) {
      return { ok: true, phoneNumber: winner.data.phoneNumber, phoneSid: winner.data.phoneSid, existed: true };
    }
  }

  return { ok: true, phoneNumber: bought.phone_number, phoneSid: bought.sid, existed: false };
}

export type { ActiveTwilioNumber };
