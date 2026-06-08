// connectors/sms/send.ts — outbound SMS via the Twilio Messages REST API (no SDK).
//
// Twilio concatenates a long Body into multi-segment SMS on its own, but a single request body is
// capped (~1600 chars). splitSmsSegments() chops a longer agent reply on whitespace boundaries so
// each chunk is one Messages request; we send them in order so the owner reads them in sequence.

import {
  type TwilioConfig,
  type TwilioResult,
  twilioAccountBase,
  twilioBasicAuth,
} from "./config";

// Twilio accepts up to 1600 chars per Messages request. Stay a little under so a chunk always fits.
const MAX_SEGMENT_CHARS = 1500;

/**
 * Split a reply into ordered chunks that each fit one Twilio Messages request. Breaks on the last
 * whitespace before the limit (falling back to a hard cut for an unbroken run), so words and lines
 * stay intact. Returns a single-element array for any reply that already fits.
 */
export function splitSmsSegments(body: string, maxChars: number = MAX_SEGMENT_CHARS): string[] {
  const trimmed = body.trim();
  if (trimmed.length <= maxChars) return trimmed.length > 0 ? [trimmed] : [];

  const segments: string[] = [];
  let rest = trimmed;
  while (rest.length > maxChars) {
    const window = rest.slice(0, maxChars);
    const lastBreak = Math.max(window.lastIndexOf("\n"), window.lastIndexOf(" "));
    const cut = lastBreak > maxChars * 0.5 ? lastBreak : maxChars;
    segments.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest.length > 0) segments.push(rest);
  return segments;
}

/**
 * Send an SMS from the owner's PA number to the original sender. Long replies are split into
 * ordered segments, each its own Messages request. Stops and returns the first failure (so a dead
 * number surfaces) rather than firing the rest into the void.
 */
export async function sendSms(
  config: TwilioConfig,
  args: { from: string; to: string; body: string },
): Promise<TwilioResult<{ segmentsSent: number }>> {
  const segments = splitSmsSegments(args.body);
  if (segments.length === 0) {
    return { ok: false, status: 422, error: "Refusing to send an empty SMS." };
  }

  let segmentsSent = 0;
  for (const segment of segments) {
    const res = await fetch(`${twilioAccountBase(config)}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: twilioBasicAuth(config),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ From: args.from, To: args.to, Body: segment }).toString(),
      cache: "no-store",
    });
    if (!res.ok) {
      return { ok: false, status: res.status, error: await res.text() };
    }
    segmentsSent++;
  }
  return { ok: true, data: { segmentsSent } };
}
