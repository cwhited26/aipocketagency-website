// connector.gmail.send — send an email reply AS the authenticated user (SPEC v5 §9.5).
//
// Sends through the Gmail API users.messages.send so the message goes out from the
// user's own Gmail, threads correctly into the original conversation, and lands in
// their Sent folder. Replaces the old external Gmail-app / mailto hand-off (which
// left the To field empty). The send scope (gmail.send) is incrementally authorized;
// a connection granted before the scope existed must re-grant before this fires.
//
// Action shape per §9.5: name, description, input schema (Zod), dry_run_summary
// (human-readable preview), execute (the real send), audit-log fields. The approval
// gate stages this action in pa_inbox_items first (the Inbox reply card, or the
// orchestrator's connector-action middleware); it fires only after the owner approves.
//
// MIME building + the schema + the dry-run summary are pure so they're unit-tested
// without a network or a DB. Only execute() touches Gmail.

import { z } from "zod";
import { sendGmailMessage, type GmailResult, type GmailSendResponse } from "@/lib/gmail";

// ─── Input schema ───────────────────────────────────────────────────────────────

// Exactly one of body_html / body_text must be present. Subject + at least one
// recipient are required. in_reply_to + thread_id thread the reply; from defaults
// to the authenticated user's primary address.
export const GmailSendInputSchema = z
  .object({
    to: z.array(z.string().min(1)).min(1, "at least one recipient is required"),
    cc: z.array(z.string().min(1)).optional(),
    bcc: z.array(z.string().min(1)).optional(),
    subject: z.string().min(1, "subject is required"),
    body_html: z.string().min(1).optional(),
    body_text: z.string().min(1).optional(),
    // RFC 2822 Message-ID of the message being replied to (e.g. "<CA+abc@mail.gmail.com>").
    // Used for the In-Reply-To + References headers so the reply threads in every client.
    in_reply_to: z.string().min(1).optional(),
    // Gmail thread id — passed to the API so the sent copy joins the conversation.
    thread_id: z.string().min(1).optional(),
    // Defaults to the authenticated user's primary address when omitted.
    from: z.string().min(1).optional(),
  })
  .refine((v) => Boolean(v.body_html) || Boolean(v.body_text), {
    message: "either body_html or body_text is required",
    path: ["body_text"],
  });

export type GmailSendInput = z.infer<typeof GmailSendInputSchema>;

// ─── MIME building (pure) ─────────────────────────────────────────────────────────

// RFC 2047 encoded-word for header values carrying non-ASCII (subjects, names).
function encodeHeaderValue(value: string): string {
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  const b64 = Buffer.from(value, "utf8").toString("base64");
  return `=?UTF-8?B?${b64}?=`;
}

// Wrap base64 body to 76-char lines so no SMTP line exceeds the 998-octet limit.
function wrapBase64(b64: string): string {
  return b64.replace(/.{1,76}/g, "$&\r\n").trimEnd();
}

// The In-Reply-To / References headers require the Message-ID in angle brackets.
function angleWrap(messageId: string): string {
  const trimmed = messageId.trim();
  if (!trimmed) return trimmed;
  return trimmed.startsWith("<") ? trimmed : `<${trimmed}>`;
}

/**
 * Build the raw RFC 2822 MIME message for a send. `fromEmail` is the connected
 * account's address, used as the From header when the input doesn't override it.
 * The body is base64-transfer-encoded so 8-bit / long-line content is safe.
 */
export function buildMimeMessage(input: GmailSendInput, fromEmail: string | null): string {
  const isHtml = Boolean(input.body_html);
  const bodyContent = input.body_html ?? input.body_text ?? "";
  const contentType = isHtml ? 'text/html; charset="UTF-8"' : 'text/plain; charset="UTF-8"';
  const bodyB64 = wrapBase64(Buffer.from(bodyContent, "utf8").toString("base64"));

  const headers: string[] = [];
  const fromValue = input.from ?? fromEmail;
  if (fromValue) headers.push(`From: ${fromValue}`);
  headers.push(`To: ${input.to.join(", ")}`);
  if (input.cc && input.cc.length > 0) headers.push(`Cc: ${input.cc.join(", ")}`);
  // Gmail strips the Bcc header before delivery; this is the standard way to bcc.
  if (input.bcc && input.bcc.length > 0) headers.push(`Bcc: ${input.bcc.join(", ")}`);
  headers.push(`Subject: ${encodeHeaderValue(input.subject)}`);
  if (input.in_reply_to) {
    const ref = angleWrap(input.in_reply_to);
    headers.push(`In-Reply-To: ${ref}`);
    headers.push(`References: ${ref}`);
  }
  headers.push("MIME-Version: 1.0");
  headers.push(`Content-Type: ${contentType}`);
  headers.push("Content-Transfer-Encoding: base64");

  return `${headers.join("\r\n")}\r\n\r\n${bodyB64}`;
}

// ─── Dry-run summary (pure, human-readable preview) ───────────────────────────────

export function dryRunSummary(input: GmailSendInput): string {
  const lines: string[] = [];
  lines.push(`Send email to ${input.to.join(", ")}`);
  if (input.cc && input.cc.length > 0) lines.push(`cc: ${input.cc.join(", ")}`);
  if (input.bcc && input.bcc.length > 0) lines.push(`bcc: ${input.bcc.join(", ")}`);
  lines.push(`Subject: ${input.subject}`);
  if (input.thread_id) lines.push("Threaded reply into the original conversation.");
  const body = input.body_text ?? input.body_html ?? "";
  const flat = body.replace(/\s+/g, " ").trim();
  const preview = flat.length > 280 ? `${flat.slice(0, 280).trimEnd()}…` : flat;
  if (preview) lines.push("", preview);
  return lines.join("\n");
}

// ─── Audit-log fields ─────────────────────────────────────────────────────────────

export type GmailSendAuditFields = {
  connector: "gmail";
  action: "send";
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  threadId: string | null;
  inReplyTo: string | null;
};

export function auditFields(input: GmailSendInput): GmailSendAuditFields {
  return {
    connector: "gmail",
    action: "send",
    to: input.to,
    cc: input.cc ?? [],
    bcc: input.bcc ?? [],
    subject: input.subject,
    threadId: input.thread_id ?? null,
    inReplyTo: input.in_reply_to ?? null,
  };
}

// ─── Execute ───────────────────────────────────────────────────────────────────────

export type GmailSendResult =
  | { ok: true; messageId: string; threadId: string; to: string[]; subject: string }
  | { ok: false; status: number; error: string; authError: boolean };

/**
 * Validate the input, build the MIME message, and send it via the Gmail API. The
 * caller supplies a fresh access token (ensureFreshAccessToken) and the connected
 * account's address. Refuses with a clear error when no recipient survives parsing —
 * that shouldn't happen because the draft generator auto-populates `to`.
 */
export async function execute(args: {
  accessToken: string;
  fromEmail: string | null;
  input: GmailSendInput;
}): Promise<GmailSendResult> {
  const recipients = args.input.to.map((r) => r.trim()).filter(Boolean);
  if (recipients.length === 0) {
    return {
      ok: false,
      status: 422,
      error: "Cannot send — recipient missing. This shouldn't happen — file a bug.",
      authError: false,
    };
  }

  const normalized: GmailSendInput = { ...args.input, to: recipients };
  const raw = buildMimeMessage(normalized, args.fromEmail);

  const sent: GmailResult<GmailSendResponse> = await sendGmailMessage(args.accessToken, {
    raw,
    threadId: normalized.thread_id ?? null,
  });
  if (!sent.ok) return sent;

  return {
    ok: true,
    messageId: sent.data.id,
    threadId: sent.data.threadId,
    to: recipients,
    subject: normalized.subject,
  };
}

// ─── Action descriptor (SPEC §9.5 shape) ──────────────────────────────────────────

export const gmailSendAction = {
  name: "gmail.send",
  description:
    "Send an email reply as the authenticated user from their connected Gmail. Threads " +
    "correctly into the original conversation when in_reply_to + thread_id are supplied, " +
    "and lands in the user's Sent folder. Approval-gated: stages in the Inbox first.",
  inputSchema: GmailSendInputSchema,
  dryRunSummary,
  auditFields,
  execute,
} as const;
