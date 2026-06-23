// sms-capture.ts — turn a parsed inbound SMS/MMS into a Capture Inbox entry. Reuses the shipped
// brain write path (fetchFileContent + appendEntryToRaw + commitMemoryFile) exactly like the email
// + iOS-share surfaces, tagging the entry source="sms" so the dashboard shows a per-surface icon.
//
// MMS media is the wrinkle: Twilio's media URLs are short-lived and behind the account's Basic
// auth, so we download each immediately (fetchTwilioMedia) and re-upload to the owner's private
// Supabase Storage bucket under pocket-capture/<owner>/<sms_msg_sid>/<filename>. The object paths
// are listed in the entry body; a media that fails to copy is recorded, never silently dropped.

import { fetchFileContent, commitMemoryFile } from "@/lib/pa-brain";
import { appendEntryToRaw } from "@/lib/pa-inbox";
import { twilioConfig } from "@/lib/connectors/sms/config";
import { fetchTwilioMedia } from "@/lib/connectors/sms/media";
import type { ParsedInboundSms } from "@/lib/connectors/sms/inbound";
import type { CaptureOwner } from "./slug";
import { uploadCaptureAttachment } from "./storage";
import type { StoredAttachment } from "./capture";

const INBOX_PATH = "memory/inbox.md";
export const SMS_SOURCE = "sms";

// Carrier compliance keywords Twilio handles itself (opt-out / help). We log them for audit but
// never capture them — they aren't the owner's thoughts, they're SMS plumbing.
const CARRIER_KEYWORDS = new Set([
  "STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT",
  "START", "YES", "UNSTOP", "HELP", "INFO",
]);

/** True when a message body is a standalone carrier keyword (STOP / HELP / …), case-insensitive. */
export function isCarrierKeyword(body: string): boolean {
  return CARRIER_KEYWORDS.has(body.trim().toUpperCase());
}

// Map a media content type to a file extension for the stored object name. Twilio gives no
// filename, so we synthesize a stable one from the index + type.
const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/heic": "heic",
  "application/pdf": "pdf",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/amr": "amr",
  "audio/ogg": "ogg",
  "video/mp4": "mp4",
  "text/vcard": "vcf",
};

/** A deterministic stored filename for the Nth MMS attachment of a message. */
export function mediaFilename(index: number, contentType: string): string {
  const ext = EXT_BY_TYPE[contentType.toLowerCase().split(";")[0]?.trim()] ?? "bin";
  return `media-${index}.${ext}`;
}

export type SmsCaptureResult =
  | { ok: true; brainPath: string; stored: StoredAttachment[]; attachmentErrors: string[] }
  | { ok: false; reason: "no-brain" | "commit-failed"; error: string };

/**
 * Compose the capture body: a provenance header (From), the text body, and a list of any stored
 * media. Pure → unit-tested.
 */
export function buildSmsCaptureContent(params: {
  fromNumber: string;
  body: string;
  stored: StoredAttachment[];
  attachmentErrors: string[];
}): string {
  const sections: string[] = [`From: ${params.fromNumber || "(unknown number)"}`];
  if (params.body.trim()) sections.push(params.body.trim());

  const attachmentLines: string[] = [
    ...params.stored.map((a) => `- ${a.filename} — stored at ${a.path}`),
    ...params.attachmentErrors.map((e) => `- ${e}`),
  ];
  if (attachmentLines.length > 0) {
    sections.push(`Attachments:\n${attachmentLines.join("\n")}`);
  }
  if (!params.body.trim() && params.stored.length === 0 && params.attachmentErrors.length === 0) {
    sections.push("[Empty text message]");
  }

  return sections.join("\n\n");
}

/**
 * Write an inbound SMS/MMS into the owner's Capture Inbox. Re-uploads each MMS attachment to
 * Storage (a failed media is recorded in the body, never silently dropped), then commits the entry
 * to the brain. Returns reason "no-brain" when the owner hasn't connected a brain repo so the
 * caller can audit it. captureId is the audit row id — it keys the Storage path so a retry upserts.
 */
export async function writeSmsCapture(params: {
  owner: CaptureOwner;
  sms: ParsedInboundSms;
  captureId: string;
}): Promise<SmsCaptureResult> {
  const { owner, sms, captureId } = params;
  if (!owner.brain_repo || !owner.github_token) {
    return { ok: false, reason: "no-brain", error: "owner has no brain repo connected" };
  }
  const repo = owner.brain_repo;
  const token = owner.github_token;

  const stored: StoredAttachment[] = [];
  const attachmentErrors: string[] = [];
  const config = twilioConfig();
  for (let i = 0; i < sms.media.length; i++) {
    const media = sms.media[i];
    const filename = mediaFilename(i, media.contentType);
    if (!config) {
      attachmentErrors.push(`${filename} — Twilio not configured, could not download`);
      continue;
    }
    const downloaded = await fetchTwilioMedia(config, media.url, media.contentType);
    if (!downloaded.ok) {
      attachmentErrors.push(`${filename} — download failed: ${downloaded.error}`);
      continue;
    }
    const upload = await uploadCaptureAttachment({
      ownerId: owner.id,
      captureId,
      filename,
      contentType: downloaded.data.contentType,
      bytes: downloaded.data.buffer,
    });
    if (upload.ok) stored.push({ filename, path: upload.path });
    else attachmentErrors.push(`${filename} — upload failed: ${upload.error}`);
  }

  const content = buildSmsCaptureContent({
    fromNumber: sms.from,
    body: sms.body,
    stored,
    attachmentErrors,
  });

  const existing = await fetchFileContent(repo, INBOX_PATH, token);
  const { content: nextRaw } = appendEntryToRaw(existing, {
    kind: "note",
    content,
    source: SMS_SOURCE,
  });

  const commit = await commitMemoryFile({
    repo,
    token,
    path: INBOX_PATH,
    mode: "replace",
    content: nextRaw,
    commitMessage: `Pocket Capture — SMS from ${sms.from}`.slice(0, 72),
  });
  if (!commit.ok) return { ok: false, reason: "commit-failed", error: commit.error };

  return { ok: true, brainPath: INBOX_PATH, stored, attachmentErrors };
}
