// screenshots.ts — store a tool screenshot in the Supabase Storage bucket `browser-screenshots`
// (prompt item 11). Owner-scoped object path (`<ownerId>/<actionId>.png`) so RLS-style isolation is
// path-structural and one owner's log can never surface another's image. Direct REST against the
// Storage API (no SDK — standing rule), service-role key.
//
// We return a SIGNED URL (1h TTL — long enough to render the log page, short enough that a leaked URL
// is useless tomorrow). The objects themselves are reaped by a 30-day TTL: Phase 1 ships the
// owner-scoped path + signed reads; the bucket's lifecycle rule (or a sweep cron) enforces the
// 30-day deletion — noted in the handoff as a one-time bucket config Chase applies with the migration.

import { paEnv } from "./supabase";
import { browserLog } from "./log";

export const SCREENSHOT_BUCKET = "browser-screenshots";
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

export type StoreScreenshotResult =
  | { ok: true; objectPath: string; signedUrl: string }
  | { ok: false; error: string };

/**
 * Upload a PNG (base64, no data: prefix) for one action and return a signed URL. Never throws —
 * a screenshot is supporting evidence, so a storage hiccup must not fail the tool call that produced
 * it (the audit row still records the action; screenshot_url is just left null).
 */
export async function storeScreenshot(params: {
  ownerId: string;
  actionId: string;
  pngBase64: string;
}): Promise<StoreScreenshotResult> {
  const env = paEnv();
  if ("error" in env) return { ok: false, error: env.error };

  const objectPath = `${params.ownerId}/${params.actionId}.png`;
  const bytes = Buffer.from(params.pngBase64, "base64");

  // 1 · Upload (upsert so a retried approval overwrites rather than 409s).
  const upload = await fetch(
    `${env.url}/storage/v1/object/${SCREENSHOT_BUCKET}/${encodeURI(objectPath)}`,
    {
      method: "POST",
      headers: {
        apikey: env.key,
        Authorization: `Bearer ${env.key}`,
        "Content-Type": "image/png",
        "x-upsert": "true",
      },
      body: bytes,
      cache: "no-store",
    },
  );
  if (!upload.ok) {
    const body = await upload.text().catch(() => "");
    browserLog.warn("screenshot upload failed", { ownerId: params.ownerId, actionId: params.actionId, status: upload.status, body: body.slice(0, 200) });
    return { ok: false, error: `upload failed (${upload.status})` };
  }

  // 2 · Sign a short-lived read URL.
  const signed = await createSignedUrl(env.url, env.key, objectPath);
  if (!signed) return { ok: false, error: "could not sign screenshot URL" };
  return { ok: true, objectPath, signedUrl: signed };
}

/**
 * Mint a fresh signed URL for an already-stored object (the log page calls this per row at render
 * time, since the stored signed URL would have expired). Returns null on failure (the row renders
 * without a thumbnail rather than breaking the page).
 */
export async function signScreenshotUrl(objectPath: string): Promise<string | null> {
  const env = paEnv();
  if ("error" in env) return null;
  return createSignedUrl(env.url, env.key, objectPath);
}

async function createSignedUrl(baseUrl: string, key: string, objectPath: string): Promise<string | null> {
  const res = await fetch(`${baseUrl}/storage/v1/object/sign/${SCREENSHOT_BUCKET}/${encodeURI(objectPath)}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: SIGNED_URL_TTL_SECONDS }),
    cache: "no-store",
  });
  if (!res.ok) {
    browserLog.warn("screenshot sign failed", { objectPath, status: res.status });
    return null;
  }
  const data = (await res.json()) as { signedURL?: string };
  if (!data.signedURL) return null;
  // The API returns a relative path under /storage/v1; make it absolute for the <img> tag.
  return data.signedURL.startsWith("http") ? data.signedURL : `${baseUrl}/storage/v1${data.signedURL}`;
}
