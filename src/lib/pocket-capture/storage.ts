// storage.ts — stage email attachments in Supabase Storage (direct REST, no SDK).
//
// Each captured email's attachments land at `<bucket>/<owner_id>/<capture_id>/<filename>` in a
// private bucket. We store the object PATH (not a URL) in the capture metadata; the dashboard feed
// (PC-CORE-6) mints a short-lived signed URL on read, so nothing is exposed by a leaked link. The
// bucket is created idempotently on first use so deploys don't need a manual provisioning step.

import { paEnv, authHeaders } from "./supabase";

/** The private bucket attachments live in. Env-overridable; the path prefix matches the SPEC. */
export const CAPTURE_BUCKET = process.env.PA_POCKET_CAPTURE_BUCKET ?? "pocket-capture";

export type UploadResult =
  | { ok: true; path: string }
  | { ok: false; error: string };

/** Sanitize an attachment filename to a safe object-key segment (no traversal, bounded). */
export function safeFilename(name: string): string {
  const base = (name.split(/[\\/]/).pop() ?? "").trim();
  const cleaned = base
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^\.+/, "") // no leading dots (hidden / relative)
    .replace(/_+/g, "_")
    .slice(0, 120);
  return cleaned || "attachment";
}

let bucketEnsured = false;

// Create the private bucket if it doesn't exist. Tolerates the already-exists response as success
// and caches the result for the lifetime of the warm function instance.
async function ensureBucket(env: { url: string; key: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  if (bucketEnsured) return { ok: true };
  const res = await fetch(`${env.url}/storage/v1/bucket`, {
    method: "POST",
    headers: { ...authHeaders(env.key), "Content-Type": "application/json" },
    body: JSON.stringify({ id: CAPTURE_BUCKET, name: CAPTURE_BUCKET, public: false }),
    cache: "no-store",
  });
  if (res.ok) {
    bucketEnsured = true;
    return { ok: true };
  }
  const body = await res.text();
  // "Bucket already exists" (409 / Duplicate) → fine, that's the state we want.
  if (res.status === 409 || /already exists|Duplicate/i.test(body)) {
    bucketEnsured = true;
    return { ok: true };
  }
  return { ok: false, error: `bucket ensure failed (${res.status}): ${body}` };
}

/**
 * Upload one attachment's bytes to `<bucket>/<ownerId>/<captureId>/<filename>` and return the
 * object path. Uses x-upsert so a webhook retry that slips past the dedup claim still no-ops
 * cleanly rather than 409-ing on an existing object.
 */
export async function uploadCaptureAttachment(params: {
  ownerId: string;
  captureId: string;
  filename: string;
  contentType: string;
  bytes: Buffer;
}): Promise<UploadResult> {
  const env = paEnv();
  if ("error" in env) return { ok: false, error: env.error };

  const ensured = await ensureBucket(env);
  if (!ensured.ok) return ensured;

  const objectPath = `${params.ownerId}/${params.captureId}/${safeFilename(params.filename)}`;
  const res = await fetch(
    `${env.url}/storage/v1/object/${CAPTURE_BUCKET}/${objectPath}`,
    {
      method: "POST",
      headers: {
        ...authHeaders(env.key),
        "Content-Type": params.contentType || "application/octet-stream",
        "x-upsert": "true",
      },
      body: new Uint8Array(params.bytes),
      cache: "no-store",
    },
  );
  if (!res.ok) {
    return { ok: false, error: `attachment upload failed (${res.status}): ${await res.text()}` };
  }
  return { ok: true, path: `${CAPTURE_BUCKET}/${objectPath}` };
}
