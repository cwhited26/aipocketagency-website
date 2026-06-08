// connectors/sms/provision.ts — provision (and release) a dedicated Twilio number for an owner.
// Direct REST against the Twilio REST API, no SDK.
//
// Provision is a two-step dance:
//   1. Search AvailablePhoneNumbers for an SMS-capable US local number in the requested area code
//      (falling back to the national pool when the area code has none, or none was requested).
//   2. Buy it via IncomingPhoneNumbers, wiring its SmsUrl to our inbound webhook in the same call —
//      so the number is texting-ready the moment it's owned.
//
// Release is a DELETE on the IncomingPhoneNumbers resource by SID.

import { z } from "zod";
import {
  type TwilioConfig,
  type TwilioResult,
  smsInboundUrl,
  twilioAccountBase,
  twilioBasicAuth,
} from "./config";

// ─── Area code helper ─────────────────────────────────────────────────────────────

/** Extract a 3-digit US area code from owner input, or null when it isn't a clean NPA. */
export function normalizeAreaCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  // A bare area code (3) or a full US number where the first 3 after the country code are the NPA.
  if (digits.length === 3) return digits;
  if (digits.length === 10) return digits.slice(0, 3);
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1, 4);
  return null;
}

/** Build the AvailablePhoneNumbers search URL — area-code-scoped, or national when areaCode null. */
export function availableNumbersUrl(config: TwilioConfig, areaCode: string | null): string {
  const url = new URL(`${twilioAccountBase(config)}/AvailablePhoneNumbers/US/Local.json`);
  url.searchParams.set("SmsEnabled", "true");
  url.searchParams.set("Limit", "1");
  if (areaCode) url.searchParams.set("AreaCode", areaCode);
  return url.toString();
}

// ─── Twilio response shapes ─────────────────────────────────────────────────────────

const AvailableNumbersSchema = z.object({
  available_phone_numbers: z.array(z.object({ phone_number: z.string().min(1) })),
});

const IncomingNumberSchema = z.object({
  sid: z.string().min(1),
  phone_number: z.string().min(1),
});

export type ProvisionedNumber = { sid: string; e164: string };

// ─── Provision ──────────────────────────────────────────────────────────────────────

async function searchAvailable(
  config: TwilioConfig,
  areaCode: string | null,
): Promise<string | null> {
  const res = await fetch(availableNumbersUrl(config, areaCode), {
    headers: { Authorization: twilioBasicAuth(config) },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const parsed = AvailableNumbersSchema.safeParse(await res.json().catch(() => null));
  if (!parsed.success) return null;
  return parsed.data.available_phone_numbers[0]?.phone_number ?? null;
}

/**
 * Provision a new SMS-capable number for the owner. Prefers the requested area code, falls back to
 * the national pool when that area code is dry (or none was given). Wires the number's SmsUrl to
 * the inbound webhook at purchase time. Returns the bought number's SID + E.164.
 */
export async function provisionNumber(
  config: TwilioConfig,
  areaCode: string | null,
): Promise<TwilioResult<ProvisionedNumber>> {
  // 1. Find a number — area code first, then national fallback.
  let candidate = await searchAvailable(config, areaCode);
  if (!candidate && areaCode) candidate = await searchAvailable(config, null);
  if (!candidate) {
    return {
      ok: false,
      status: 404,
      error: areaCode
        ? `No SMS numbers are available in area code ${areaCode} or the national pool right now. Try again or pick a different area code.`
        : "No SMS numbers are available right now. Try again in a moment.",
    };
  }

  // 2. Buy it, wiring the inbound webhook in the same request.
  const res = await fetch(`${twilioAccountBase(config)}/IncomingPhoneNumbers.json`, {
    method: "POST",
    headers: {
      Authorization: twilioBasicAuth(config),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      PhoneNumber: candidate,
      SmsUrl: smsInboundUrl(),
      SmsMethod: "POST",
    }).toString(),
    cache: "no-store",
  });
  if (!res.ok) {
    return { ok: false, status: res.status, error: await res.text() };
  }
  const parsed = IncomingNumberSchema.safeParse(await res.json().catch(() => null));
  if (!parsed.success) {
    return { ok: false, status: 502, error: "Twilio returned an unexpected provision response." };
  }
  return { ok: true, data: { sid: parsed.data.sid, e164: parsed.data.phone_number } };
}

// ─── Release ──────────────────────────────────────────────────────────────────────────

/** Release a number back to Twilio (stops billing for it). 404 is treated as already-gone (ok). */
export async function releaseNumber(
  config: TwilioConfig,
  twilioPhoneSid: string,
): Promise<TwilioResult<void>> {
  const res = await fetch(
    `${twilioAccountBase(config)}/IncomingPhoneNumbers/${encodeURIComponent(twilioPhoneSid)}.json`,
    {
      method: "DELETE",
      headers: { Authorization: twilioBasicAuth(config) },
      cache: "no-store",
    },
  );
  if (res.ok || res.status === 404) return { ok: true, data: undefined };
  return { ok: false, status: res.status, error: await res.text() };
}
