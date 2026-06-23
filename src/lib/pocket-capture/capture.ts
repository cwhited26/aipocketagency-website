// capture.ts — turn a parsed inbound email into a Capture Inbox entry. Reuses the shipped brain
// write path (fetchFileContent + appendEntryToRaw + commitMemoryFile) exactly like the iOS share
// endpoint, tagging the entry source="email_forward" so the dashboard can show a per-surface icon.
// Attachments are staged in Supabase Storage first; their object paths are listed in the entry body.

import { fetchFileContent, commitMemoryFile } from "@/lib/pa-brain";
import { appendEntryToRaw } from "@/lib/pa-inbox";
import type { ParsedInboundEmail } from "@/lib/inbound-email/parse";
import type { CaptureOwner } from "./slug";
import { uploadCaptureAttachment } from "./storage";

const INBOX_PATH = "memory/inbox.md";
export const EMAIL_FORWARD_SOURCE = "email_forward";

export type StoredAttachment = { filename: string; path: string };

export type EmailCaptureResult =
  | { ok: true; brainPath: string; stored: StoredAttachment[]; attachmentErrors: string[] }
  | { ok: false; reason: "no-brain" | "commit-failed"; error: string };

/**
 * Compose the capture body: a provenance header (From / Subject), the reply-chain-stripped body,
 * and a list of any stored attachments. Pure → unit-tested.
 */
export function buildCaptureContent(params: {
  fromDisplay: string;
  subject: string;
  strippedBody: string;
  stored: StoredAttachment[];
  attachmentErrors: string[];
}): string {
  const parts: string[] = [
    `From: ${params.fromDisplay || "(unknown sender)"}`,
    `Subject: ${params.subject || "(no subject)"}`,
  ];
  const header = parts.join("\n");

  const sections: string[] = [header];
  if (params.strippedBody.trim()) sections.push(params.strippedBody.trim());

  const attachmentLines: string[] = [
    ...params.stored.map((a) => `- ${a.filename} — stored at ${a.path}`),
    ...params.attachmentErrors.map((e) => `- ${e}`),
  ];
  if (attachmentLines.length > 0) {
    sections.push(`Attachments:\n${attachmentLines.join("\n")}`);
  }

  return sections.join("\n\n");
}

/**
 * Write a forwarded email into the owner's Capture Inbox. Stages attachments to Storage (a failed
 * attachment is recorded in the body, never silently dropped), then commits the entry to the brain.
 * Returns reason "no-brain" when the owner hasn't connected a brain repo so the caller can audit it.
 */
export async function writeEmailCapture(params: {
  owner: CaptureOwner;
  email: ParsedInboundEmail;
  strippedBody: string;
  captureId: string;
}): Promise<EmailCaptureResult> {
  const { owner, email, strippedBody, captureId } = params;
  if (!owner.brain_repo || !owner.github_token) {
    return { ok: false, reason: "no-brain", error: "owner has no brain repo connected" };
  }
  const repo = owner.brain_repo;
  const token = owner.github_token;

  const stored: StoredAttachment[] = [];
  const attachmentErrors: string[] = [];
  for (const att of email.attachments) {
    const upload = await uploadCaptureAttachment({
      ownerId: owner.id,
      captureId,
      filename: att.filename,
      contentType: att.contentType,
      bytes: Buffer.from(att.content, "base64"),
    });
    if (upload.ok) stored.push({ filename: att.filename, path: upload.path });
    else attachmentErrors.push(`${att.filename} — upload failed: ${upload.error}`);
  }

  const content = buildCaptureContent({
    fromDisplay: email.fromRaw || email.fromAddr,
    subject: email.subject,
    strippedBody,
    stored,
    attachmentErrors,
  });

  const existing = await fetchFileContent(repo, INBOX_PATH, token);
  const { content: nextRaw } = appendEntryToRaw(existing, {
    kind: "note",
    content,
    title: email.subject || undefined,
    source: EMAIL_FORWARD_SOURCE,
  });

  const commit = await commitMemoryFile({
    repo,
    token,
    path: INBOX_PATH,
    mode: "replace",
    content: nextRaw,
    commitMessage: `Pocket Capture — email forward: ${email.subject || "(no subject)"}`.slice(0, 72),
  });
  if (!commit.ok) return { ok: false, reason: "commit-failed", error: commit.error };

  return { ok: true, brainPath: INBOX_PATH, stored, attachmentErrors };
}
