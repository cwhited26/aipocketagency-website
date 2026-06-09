// handle-inbound.ts — the @inbound ("act on this") verb. An owner forwards an email to
// <owner>@inbound; PA treats it as a chat message: it lands as a user turn in the owner's
// "Email forwards" conversation (attachments run the canonical capture pipeline), the agent
// reads it and replies, and the reply goes back out via Resend with In-Reply-To so it
// threads into the forward in the owner's inbox.

import { fetchPaUser } from "@/lib/pa-supabase";
import {
  listConversations,
  createConversation,
  insertMessage,
} from "@/lib/pa-conversations";
import { absorbToMemory, isAllowedUploadType } from "@/lib/brain/absorb";
import { maybeIngestYouTubeUrls, buildYouTubeContextAppend } from "@/lib/youtube/ingest";
import { maybeIngestPodcastUrls, buildPodcastContextAppend } from "@/lib/podcasts/hooks";
import { sendTransactional } from "@/lib/email/resend";
import { fetchAuthUserEmail } from "@/lib/connectors/system/recipient";
import { generateInboundReply } from "./agent";
import { logInboundEmail } from "./log";
import type { ParsedInboundEmail } from "./parse";

const FORWARDS_TITLE = "Email forwards";

export type HandleResult =
  | { ok: true; replied: boolean }
  | { ok: false; status: number; error: string };

// Find or create the single "Email forwards" conversation for this owner.
async function ensureForwardsConversation(ownerId: string): Promise<{ ok: true; id: string } | { ok: false; status: number; error: string }> {
  const list = await listConversations(ownerId);
  if (!list.ok) return list;
  const existing = list.data.find((c) => c.title === FORWARDS_TITLE);
  if (existing) return { ok: true, id: existing.id };
  const created = await createConversation(ownerId, FORWARDS_TITLE);
  if (!created.ok) return created;
  return { ok: true, id: created.data.id };
}

// Run each attachment through the canonical capture pipeline (store + absorb when readable).
// Returns the human note appended to the user turn. Never throws — a failed attachment is
// reported in the note, not swallowed.
async function absorbAttachments(
  repo: string,
  token: string,
  anthropicApiKey: string | null,
  email: ParsedInboundEmail,
): Promise<string> {
  if (email.attachments.length === 0) return "";
  const lines: string[] = [];
  for (const att of email.attachments) {
    if (!isAllowedUploadType(att.contentType)) {
      lines.push(`• ${att.filename} — skipped (unsupported type ${att.contentType})`);
      continue;
    }
    const result = await absorbToMemory({
      repo,
      token,
      anthropicApiKey,
      fileName: att.filename,
      mimeType: att.contentType,
      buffer: Buffer.from(att.content, "base64"),
    });
    lines.push(
      result.ok
        ? `• ${att.filename} — saved to Documents${result.absorbed ? " + absorbed into memory" : ""}`
        : `• ${att.filename} — could not save: ${result.error}`,
    );
  }
  return `\n\nAttachments:\n${lines.join("\n")}`;
}

export async function handleInboundForward(params: {
  ownerId: string;
  toAddress: string;
  email: ParsedInboundEmail;
}): Promise<HandleResult> {
  const { ownerId, email, toAddress } = params;

  const paResult = await fetchPaUser(ownerId);
  if (!paResult.ok) return { ok: false, status: paResult.status, error: paResult.error };
  const paUser = paResult.data;

  const brainRepo = paUser?.brain_repo ?? null;
  const githubToken = paUser?.github_token ?? null;
  const anthropicApiKey = paUser?.anthropic_api_key ?? null;

  // Attachments first (so the user turn can mention them).
  let attachmentNote = "";
  if (email.attachments.length > 0 && brainRepo && githubToken) {
    attachmentNote = await absorbAttachments(brainRepo, githubToken, anthropicApiKey, email);
  } else if (email.attachments.length > 0) {
    attachmentNote = `\n\nAttachments: ${email.attachments
      .map((a) => a.filename)
      .join(", ")} (connect your brain to save them).`;
  }

  const conv = await ensureForwardsConversation(ownerId);
  if (!conv.ok) return conv;

  const bodyText = email.text.trim() || email.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  // A YouTube link in the forwarded email → ingest it (transcript + metadata → brain note) and fold
  // the transcript into the turn so PA's reply can act on the video, not just the URL.
  const ytResults = await maybeIngestYouTubeUrls(bodyText, ownerId, "inbound_email");
  // A podcast link in the forwarded email → transcribe the episode too, same as the video path.
  const pcResults = await maybeIngestPodcastUrls(bodyText, ownerId, "inbound_email");
  const ytContext = [buildYouTubeContextAppend(ytResults), buildPodcastContextAppend(pcResults)]
    .filter(Boolean)
    .join("\n\n");
  const bodyWithVideo = [bodyText, ytContext].filter(Boolean).join("\n\n");

  const userTurn =
    `Forwarded email — From: ${email.fromRaw || email.fromAddr} · Subject: ${email.subject || "(no subject)"}\n\n` +
    `${bodyWithVideo}${attachmentNote}`;

  const userMsg = await insertMessage({
    conversationId: conv.id,
    userId: ownerId,
    role: "user",
    content: userTurn,
  });
  if (!userMsg.ok) return { ok: false, status: userMsg.status, error: userMsg.error };

  // No Anthropic key → log the receipt and stop (the turn is captured; nothing to reply with).
  if (!anthropicApiKey) {
    await logInboundEmail({
      ownerId,
      addressKind: "inbound",
      fromAddr: email.fromAddr,
      toAddr: toAddress,
      subject: email.subject,
      bodyText,
      brainPath: null,
      status: "received",
    });
    return { ok: true, replied: false };
  }

  // When a video or podcast episode was ingested, give the reply agent the transcript by augmenting
  // the email body.
  const emailForReply = ytContext ? { ...email, text: bodyWithVideo } : email;
  const generated = await generateInboundReply({ anthropicApiKey, brainRepo, githubToken, email: emailForReply });
  if (!generated.ok) return { ok: false, status: generated.status, error: generated.error };

  const asstMsg = await insertMessage({
    conversationId: conv.id,
    userId: ownerId,
    role: "assistant",
    content: generated.reply,
  });
  if (!asstMsg.ok) return { ok: false, status: asstMsg.status, error: asstMsg.error };

  // Reply to the forwarder (the owner). Fall back to the auth email if the From was blank.
  let replyTo = email.fromAddr;
  if (!replyTo) {
    const recipient = await fetchAuthUserEmail(ownerId);
    replyTo = recipient.ok ? recipient.email ?? "" : "";
  }

  let replied = false;
  if (replyTo) {
    const subject = email.subject ? `Re: ${email.subject.replace(/^re:\s*/i, "")}` : "Re: your forwarded email";
    const ref = email.messageId ? (email.messageId.startsWith("<") ? email.messageId : `<${email.messageId}>`) : "";
    const headers: Record<string, string> = {};
    if (ref) {
      headers["In-Reply-To"] = ref;
      headers["References"] = ref;
    }
    const sent = await sendTransactional({
      to: replyTo,
      subject,
      text: generated.reply,
      html: `<div style="white-space:pre-wrap;font-family:system-ui,sans-serif">${escapeHtml(generated.reply)}</div>`,
      // Keyed so a webhook retry never sends a second reply to the same forward.
      idempotencyKey: email.messageId ? `inbound_reply:${email.messageId}` : undefined,
      headers,
    });
    replied = sent.ok;
  }

  await logInboundEmail({
    ownerId,
    addressKind: "inbound",
    fromAddr: email.fromAddr,
    toAddr: toAddress,
    subject: email.subject,
    bodyText,
    brainPath: null,
    status: replied ? "reply-sent" : "received",
  });

  return { ok: true, replied };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
