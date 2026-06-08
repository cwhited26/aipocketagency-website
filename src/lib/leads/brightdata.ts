// brightdata.ts — fetch a URL's rendered HTML through Bright Data's Web Unlocker.
//
// Direct REST, no SDK. The Web Unlocker "native" API is a single POST to api.brightdata.com/request
// with the target URL, the Web Unlocker zone, and format=raw — Bright Data handles the proxying,
// CAPTCHA-solving, and JS rendering and returns the final HTML as the response body. The zone name is
// account-specific (the zone the owner created in their Bright Data dashboard); it defaults to
// "web_unlocker1" (Bright Data's default name) and is overridable per-deployment via BRIGHT_DATA_ZONE.
//
// Typed result, hard timeout, no silent catch — a fetch failure becomes a clean { ok:false } the
// orchestrator records on the lead row, never an unhandled throw that fails the whole batch.

const BRIGHT_DATA_REQUEST_URL = "https://api.brightdata.com/request";

function unlockerZone(): string {
  return process.env.BRIGHT_DATA_ZONE ?? "web_unlocker1";
}

export type UnlockerResult =
  | { ok: true; html: string }
  | { ok: false; status: number; error: string };

/**
 * Fetch one URL through the Web Unlocker. `apiKey` is the resolved Bright Data key (owner's own or
 * PA's shared platform key — see resolveBrightData). Returns the rendered HTML on success.
 */
export async function fetchViaUnlocker(params: {
  apiKey: string;
  url: string;
  /** Network abort, ms. Rendering a heavy page through the proxy is slow; default 45s. */
  timeoutMs?: number;
}): Promise<UnlockerResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), params.timeoutMs ?? 45_000);

  let res: Response;
  try {
    res = await fetch(BRIGHT_DATA_REQUEST_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        zone: unlockerZone(),
        url: params.url,
        format: "raw",
      }),
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    const reason = err instanceof Error && err.name === "AbortError" ? "timed out" : "network error";
    return { ok: false, status: 504, error: `Bright Data fetch ${reason}.` };
  }
  clearTimeout(timer);

  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 160);
    if (res.status === 401 || res.status === 403) {
      return { ok: false, status: res.status, error: "Bright Data rejected the API key." };
    }
    return { ok: false, status: res.status, error: `Bright Data returned ${res.status}. ${detail}`.trim() };
  }

  const html = await res.text();
  if (!html.trim()) {
    return { ok: false, status: 502, error: "Bright Data returned an empty page." };
  }
  return { ok: true, html };
}
