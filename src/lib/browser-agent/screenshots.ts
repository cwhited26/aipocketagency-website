// screenshots.ts — Browser Agent step screenshots in the private Storage bucket
// `pa-browser-screenshots`, one object per step at <owner_id>/<job_id>/<step>.png. Same
// direct-REST + signed-URL discipline as lib/browser/screenshots.ts (Phase 1): owner-scoped
// paths make isolation structural, signed URLs are minted fresh per render (1h TTL), and a
// storage hiccup never fails the step that produced the image.

import { paEnv } from "@/lib/browser/supabase";
import { BROWSER_AGENT_SCREENSHOT_BUCKET } from "./constants";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

export type StoreJobScreenshotResult =
  | { ok: true; objectPath: string }
  | { ok: false; error: string };

export async function storeJobScreenshot(params: {
  ownerId: string;
  jobId: string;
  stepNumber: number;
  pngBase64: string;
}): Promise<StoreJobScreenshotResult> {
  const env = paEnv();
  if ("error" in env) return { ok: false, error: env.error };

  const objectPath = `${params.ownerId}/${params.jobId}/${params.stepNumber}.png`;
  const bytes = Buffer.from(params.pngBase64, "base64");

  const upload = await fetch(
    `${env.url}/storage/v1/object/${BROWSER_AGENT_SCREENSHOT_BUCKET}/${encodeURI(objectPath)}`,
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
    console.warn("[browser-agent/screenshots] upload failed", {
      jobId: params.jobId,
      stepNumber: params.stepNumber,
      status: upload.status,
      body: body.slice(0, 200),
    });
    return { ok: false, error: `upload failed (${upload.status})` };
  }
  return { ok: true, objectPath };
}

/** Fresh signed read URL for a stored step screenshot; null renders the row without a thumbnail. */
export async function signJobScreenshotUrl(objectPath: string): Promise<string | null> {
  const env = paEnv();
  if ("error" in env) return null;

  const res = await fetch(
    `${env.url}/storage/v1/object/sign/${BROWSER_AGENT_SCREENSHOT_BUCKET}/${encodeURI(objectPath)}`,
    {
      method: "POST",
      headers: { apikey: env.key, Authorization: `Bearer ${env.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: SIGNED_URL_TTL_SECONDS }),
      cache: "no-store",
    },
  );
  if (!res.ok) {
    console.warn("[browser-agent/screenshots] sign failed", { objectPath, status: res.status });
    return null;
  }
  const data = (await res.json()) as { signedURL?: string };
  if (!data.signedURL) return null;
  return data.signedURL.startsWith("http") ? data.signedURL : `${env.url}/storage/v1${data.signedURL}`;
}
