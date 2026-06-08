// connectors/sms/media.ts — download an MMS attachment from a Twilio Media URL. The media resource
// sits behind the account's HTTP Basic auth and 307-redirects to the actual bytes (fetch follows
// the redirect by default). Used to pull voice-memo audio (→ Whisper) and images (→ vision OCR).

import { type TwilioConfig, type TwilioResult, twilioBasicAuth } from "./config";

// Cap a single MMS download so a hostile/huge attachment can't blow memory. Twilio's own MMS limit
// is well under this; Whisper accepts up to 25 MB, so this is the binding ceiling.
const MAX_MEDIA_BYTES = 25 * 1024 * 1024;

export type TwilioMedia = { buffer: Buffer; contentType: string };

/**
 * Download one Twilio media attachment. `fallbackContentType` is the MediaContentTypeN value from
 * the webhook payload, used when the redirected response omits a usable Content-Type. Enforces the
 * size cap; never throws on a network error — returns a typed failure instead.
 */
export async function fetchTwilioMedia(
  config: TwilioConfig,
  url: string,
  fallbackContentType: string,
): Promise<TwilioResult<TwilioMedia>> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: twilioBasicAuth(config) },
      cache: "no-store",
    });
  } catch (e) {
    return {
      ok: false,
      status: 502,
      error: e instanceof Error ? `Media fetch failed: ${e.message}` : "Media fetch failed.",
    };
  }
  if (!res.ok) {
    return { ok: false, status: res.status, error: `Media fetch returned ${res.status}.` };
  }

  const arrayBuffer = await res.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_MEDIA_BYTES) {
    return {
      ok: false,
      status: 413,
      error: `Attachment too large (${(arrayBuffer.byteLength / 1_048_576).toFixed(1)} MB).`,
    };
  }
  const contentType = res.headers.get("content-type")?.split(";")[0]?.trim() || fallbackContentType;
  return { ok: true, data: { buffer: Buffer.from(arrayBuffer), contentType } };
}
