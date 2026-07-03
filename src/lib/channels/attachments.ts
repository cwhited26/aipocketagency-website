// lib/channels/attachments.ts — stage inbound channel media in Supabase Storage (direct REST,
// no SDK). Channels Gateway Phase 2: an MMS photo texted to the owner's PA number is downloaded
// from Twilio (behind Basic auth) and parked at
//   pa-channel-attachments/<channel>/<owner_id>/<msg_id>/<n>.<ext>
// in a private bucket. The object PATH (not a URL) is recorded on the pa_channel_messages row's
// attachments jsonb; anything that surfaces it later mints a short-lived signed URL on read.
// The bucket is created idempotently on first use (same pattern as pocket-capture/storage.ts) so
// deploys don't need a manual provisioning step.

import { channelLog } from "./log";
import type { ChannelSlug } from "./types";

/** The private bucket channel media lands in. Env-overridable; path prefix matches the task spec. */
export const CHANNEL_ATTACHMENTS_BUCKET =
  process.env.PA_CHANNEL_ATTACHMENTS_BUCKET ?? "pa-channel-attachments";

// One stored attachment, as recorded on pa_channel_messages.attachments.
export type StoredChannelAttachment = {
  path: string;
  contentType: string;
  bytes: number;
};

type UploadResult = { ok: true; data: StoredChannelAttachment } | { ok: false; error: string };

function paEnv(): { url: string; key: string } | { error: string } {
  const url =
    process.env.POCKET_AGENT_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.WC_ADMIN_SUPABASE_URL;
  const key =
    process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.WC_ADMIN_SUPABASE_SERVICE_KEY;
  if (!url || !key) return { error: "Supabase service-role env vars not set" };
  return { url: url.replace(/\/$/, ""), key };
}

function authHeaders(key: string): Record<string, string> {
  return { apikey: key, Authorization: `Bearer ${key}` };
}

// Map a media content type to a filename extension (bounded allowlist; anything else is .bin).
export function extensionForContentType(contentType: string): string {
  const base = contentType.toLowerCase().split(";")[0].trim();
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/heic": "heic",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/ogg": "ogg",
    "audio/amr": "amr",
    "video/mp4": "mp4",
    "application/pdf": "pdf",
    "text/vcard": "vcf",
  };
  return map[base] ?? "bin";
}

let bucketEnsured = false;

async function ensureBucket(env: { url: string; key: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  if (bucketEnsured) return { ok: true };
  const res = await fetch(`${env.url}/storage/v1/bucket`, {
    method: "POST",
    headers: { ...authHeaders(env.key), "Content-Type": "application/json" },
    body: JSON.stringify({
      id: CHANNEL_ATTACHMENTS_BUCKET,
      name: CHANNEL_ATTACHMENTS_BUCKET,
      public: false,
    }),
    cache: "no-store",
  });
  if (res.ok) {
    bucketEnsured = true;
    return { ok: true };
  }
  const body = await res.text();
  if (res.status === 409 || /already exists|Duplicate/i.test(body)) {
    bucketEnsured = true;
    return { ok: true };
  }
  return { ok: false, error: `bucket ensure failed (${res.status}): ${body}` };
}

/**
 * Upload one inbound attachment's bytes and return its stored descriptor. `messageId` is the
 * provider-stable message id (Twilio MessageSid) so a webhook redelivery upserts the same object
 * (x-upsert) rather than duplicating or 409-ing.
 */
export async function uploadChannelAttachment(params: {
  channelSlug: ChannelSlug;
  ownerId: string;
  messageId: string;
  index: number;
  contentType: string;
  bytes: Buffer;
}): Promise<UploadResult> {
  const env = paEnv();
  if ("error" in env) return { ok: false, error: env.error };

  const ensured = await ensureBucket(env);
  if (!ensured.ok) return ensured;

  const safeMsgId = params.messageId.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
  const ext = extensionForContentType(params.contentType);
  const objectPath = `${params.channelSlug}/${params.ownerId}/${safeMsgId}/${params.index}.${ext}`;
  const res = await fetch(`${env.url}/storage/v1/object/${CHANNEL_ATTACHMENTS_BUCKET}/${objectPath}`, {
    method: "POST",
    headers: {
      ...authHeaders(env.key),
      "Content-Type": params.contentType || "application/octet-stream",
      "x-upsert": "true",
    },
    body: new Uint8Array(params.bytes),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    channelLog.error("channel attachment upload failed", {
      channelSlug: params.channelSlug,
      status: res.status,
    });
    return { ok: false, error: `attachment upload failed (${res.status}): ${body}` };
  }
  return {
    ok: true,
    data: {
      path: `${CHANNEL_ATTACHMENTS_BUCKET}/${objectPath}`,
      contentType: params.contentType,
      bytes: params.bytes.byteLength,
    },
  };
}
