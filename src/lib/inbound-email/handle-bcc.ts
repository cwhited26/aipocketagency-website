// handle-bcc.ts — the @bcc ("be aware") verb. An owner BCCs <owner>@bcc on an outgoing
// email; PA logs the touchpoint to the brain, then registers a thread-watch so the
// gmail-sync cron can draft the owner's reply when the recipient writes back.

import { fetchPaUser } from "@/lib/pa-supabase";
import { commitBrainTextFile } from "@/lib/brain/absorb";
import { maybeIngestYouTubeUrls } from "@/lib/youtube/ingest";
import { maybeIngestPodcastUrls } from "@/lib/podcasts/hooks";
import { slugifyForPath } from "./slug";
import { createBccWatch } from "./bcc-watch";
import { logInboundEmail } from "./log";
import { classifyAddress, type ParsedInboundEmail } from "./parse";

export type HandleResult =
  | { ok: true; watched: boolean; brainPath: string | null }
  | { ok: false; status: number; error: string };

/** The brain path a BCC'd email is logged under: brain/email-log/YYYY-MM-DD/<recipient>-<subject>.md */
export function bccBrainPath(recipientAddr: string, subject: string, receivedIso: string): string {
  const date = receivedIso.slice(0, 10);
  const recip = slugifyForPath(recipientAddr.split("@")[0] ?? recipientAddr, "recipient", 40);
  const subj = slugifyForPath(subject, "no-subject", 60);
  return `brain/email-log/${date}/${recip}-${subj}.md`;
}

function buildLogMarkdown(email: ParsedInboundEmail, recipientAddr: string, receivedIso: string): string {
  const body = email.text.trim() || email.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return (
    `# Email sent — ${email.subject || "(no subject)"}\n\n` +
    `- **To:** ${recipientAddr}\n` +
    `- **From (you):** ${email.fromRaw || email.fromAddr}\n` +
    `- **Sent:** ${receivedIso}\n` +
    `- **Message-ID:** ${email.messageId || "(none)"}\n\n` +
    `---\n\n${body}\n`
  );
}

export async function handleBccAwareness(params: {
  ownerId: string;
  toAddress: string;
  email: ParsedInboundEmail;
}): Promise<HandleResult> {
  const { ownerId, email, toAddress } = params;

  // The recipient to watch = the first visible recipient that isn't one of our own
  // inbound subdomains (i.e. the person the owner actually emailed).
  const recipientAddr = email.toAddrs.find((a) => classifyAddress(a) === null) ?? "";
  if (!recipientAddr) {
    return { ok: false, status: 422, error: "No external recipient to watch on the BCC'd email." };
  }

  const paResult = await fetchPaUser(ownerId);
  if (!paResult.ok) return { ok: false, status: paResult.status, error: paResult.error };
  const paUser = paResult.data;
  const brainRepo = paUser?.brain_repo ?? null;
  const githubToken = paUser?.github_token ?? null;

  const receivedIso = new Date().toISOString();
  const bodyText = email.text.trim() || email.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  // 1. Log the touchpoint to the brain (best-effort: a brain-write failure must not lose the
  //    watch — we record the attempt honestly via brainPath=null).
  let brainPath: string | null = null;
  if (brainRepo && githubToken) {
    const path = bccBrainPath(recipientAddr, email.subject, receivedIso);
    const committed = await commitBrainTextFile({
      repo: brainRepo,
      token: githubToken,
      path,
      content: buildLogMarkdown(email, recipientAddr, receivedIso),
      commitMessage: `Pocket Agent — log outgoing email to ${recipientAddr}`,
    });
    if (committed.ok) brainPath = path;
  }

  // 1b. If the BCC'd email links a YouTube video or a podcast episode, ingest it (transcript → its
  //     own brain note) so the owner's brain captures the content, not just that the email went out.
  await maybeIngestYouTubeUrls(bodyText, ownerId, "bcc");
  await maybeIngestPodcastUrls(bodyText, ownerId, "bcc");

  // 2. Register the thread-watch so the cron can draft the reply when the recipient responds.
  const watch = await createBccWatch({
    ownerId,
    gmailThreadOrMsgId: email.messageId || `${recipientAddr}:${email.subject}`,
    originalRfcMessageId: email.messageId || null,
    recipientAddr,
    originalSubject: email.subject,
  });
  if (!watch.ok) return { ok: false, status: watch.status, error: watch.error };

  // 3. Log to the privacy-review table.
  await logInboundEmail({
    ownerId,
    addressKind: "bcc",
    fromAddr: email.fromAddr,
    toAddr: toAddress,
    subject: email.subject,
    bodyText,
    brainPath,
    status: "received",
  });

  return { ok: true, watched: true, brainPath };
}
