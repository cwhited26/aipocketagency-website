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

// The SERP zone drives the Google Maps sweep (Phase 2). Bright Data's SERP API rides the SAME
// POST api.brightdata.com/request endpoint as the Web Unlocker — only the zone differs — and returns
// parsed JSON (not HTML) when the target URL carries &brd_json=1. Defaults to Bright Data's "serp"
// zone name, overridable per-deployment.
function serpZone(): string {
  return process.env.BRIGHT_DATA_SERP_ZONE ?? "serp";
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

// ── Google Maps SERP (Phase 2) ───────────────────────────────────────────────

/**
 * One normalized business listing off a Google Maps SERP. Bright Data doesn't pin every field name
 * on the `maps` vertical, so the parser checks a few candidate keys per field and leaves anything it
 * can't find empty/null — a missing website is the headline signal, never a parse crash.
 */
export type MapsBusiness = {
  name: string;
  /** The website the listing advertises, "" when it has none (the no-website signal). */
  website: string;
  /** The Google Maps listing URL — always present so a no-website lead still has a link. */
  mapsUrl: string;
  phone: string;
  email: string;
  rating: number | null;
  reviewsCount: number | null;
  address: string;
  category: string;
};

export type MapsSerpResult =
  | { ok: true; businesses: MapsBusiness[] }
  | { ok: false; status: number; error: string };

type RawMapsRecord = Record<string, unknown>;

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function firstStr(rec: RawMapsRecord, keys: string[]): string {
  for (const k of keys) {
    const v = str(rec[k]);
    if (v) return v;
  }
  return "";
}

function numOrNull(rec: RawMapsRecord, keys: string[]): number | null {
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const parsed = Number(v.replace(/[,\s]/g, ""));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

// A Facebook / Instagram / other social or link-aggregator page is NOT a real website — treat it as
// "no website" so the no-website filter (PA-LS-9) keeps these as exactly the leads the owner is
// hunting for (a business whose only web presence is a Facebook page still needs a real site).
const SOCIAL_HOSTS = [
  "facebook.com",
  "fb.com",
  "instagram.com",
  "linktr.ee",
  "linktree.com",
  "yelp.com",
  "google.com",
  "linkedin.com",
  "twitter.com",
  "x.com",
  "tiktok.com",
];

export function isRealWebsite(rawUrl: string): boolean {
  const url = rawUrl.trim();
  if (!url) return false;
  let host: string;
  try {
    host = new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return false;
  }
  return !SOCIAL_HOSTS.some((s) => host === s || host.endsWith(`.${s}`));
}

function normalizeBusiness(rec: RawMapsRecord): MapsBusiness | null {
  const name = firstStr(rec, ["name", "title", "business_name"]);
  const mapsUrl = firstStr(rec, ["maps_url", "link", "url", "google_url"]);
  if (!name && !mapsUrl) return null; // not a real listing

  const rawWebsite = firstStr(rec, ["website", "site", "web_site", "domain"]);
  return {
    name,
    website: isRealWebsite(rawWebsite) ? rawWebsite : "",
    mapsUrl,
    phone: firstStr(rec, ["phone", "phone_number", "telephone"]),
    email: firstStr(rec, ["email", "contact_email"]),
    rating: numOrNull(rec, ["rating", "stars"]),
    reviewsCount: numOrNull(rec, ["reviews_cnt", "reviews", "reviews_count", "review_count"]),
    address: firstStr(rec, ["address", "full_address", "formatted_address"]),
    category: firstStr(rec, ["category", "type", "categories"]),
  };
}

type SerpEnvelope = { maps?: unknown; local_results?: unknown; organic?: unknown };

/** Pull the business array out of whichever key the SERP envelope used. */
function extractRecords(envelope: SerpEnvelope): RawMapsRecord[] {
  const candidate = envelope.maps ?? envelope.local_results;
  if (!Array.isArray(candidate)) return [];
  return candidate.filter((r): r is RawMapsRecord => typeof r === "object" && r !== null);
}

/**
 * Run one Google Maps SERP query through Bright Data and return the normalized businesses on that
 * page. `page` is 0-indexed (Google's `start` = page*20). Typed result, hard timeout, no silent
 * catch — a failure becomes a clean { ok:false } the sweep records, never an unhandled throw.
 */
export async function fetchMapsViaSerp(params: {
  apiKey: string;
  /** e.g. "roofing in Knoxville, TN" */
  query: string;
  page?: number;
  timeoutMs?: number;
}): Promise<MapsSerpResult> {
  const start = (params.page ?? 0) * 20;
  // Google Maps "search" with brd_json=1 makes Bright Data return parsed SERP JSON, including the
  // `maps` local-business vertical. tbm=lcl scopes the SERP to the local pack.
  const target = `https://www.google.com/search?tbm=lcl&q=${encodeURIComponent(params.query)}&start=${start}&brd_json=1`;

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
      body: JSON.stringify({ zone: serpZone(), url: target, format: "raw" }),
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    const reason = err instanceof Error && err.name === "AbortError" ? "timed out" : "network error";
    return { ok: false, status: 504, error: `Bright Data Maps fetch ${reason}.` };
  }
  clearTimeout(timer);

  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 160);
    if (res.status === 401 || res.status === 403) {
      return { ok: false, status: res.status, error: "Bright Data rejected the API key." };
    }
    return { ok: false, status: res.status, error: `Bright Data returned ${res.status}. ${detail}`.trim() };
  }

  const body = await res.text();
  if (!body.trim()) return { ok: false, status: 502, error: "Bright Data returned an empty result." };

  let envelope: SerpEnvelope;
  try {
    envelope = JSON.parse(body) as SerpEnvelope;
  } catch {
    return { ok: false, status: 502, error: "Bright Data returned an unexpected (non-JSON) result." };
  }

  const businesses = extractRecords(envelope)
    .map(normalizeBusiness)
    .filter((b): b is MapsBusiness => b !== null);
  return { ok: true, businesses };
}
