// watch-runner.ts — the gmail-sync cron's BCC pass. For each owner, match the new inbox
// messages this cycle against their open thread-watches; when a watched recipient replies,
// draft the owner's response (Email Drafter, grounded in the brain) and stage it in Mission
// Control with sourceSurface='bcc-reply'. Also expires watches past their 30-day window.
//
// Matching heuristic (documented in the SPEC): a candidate matches a watch when it is FROM the
// watched recipient AND its subject is the watched subject (ignoring a leading Re:/Fwd:). The
// drafted reply threads onto the recipient's reply via thread_id + in_reply_to.

import { fetchPaUser } from "@/lib/pa-supabase";
import { createInboxItem } from "@/lib/pa-inbox-items";
import { generateEmailDraft } from "@/lib/pa-drafts";
import type { GmailMessageMeta } from "@/lib/gmail";
import { extractEmailAddress } from "./parse";
import {
  fetchOpenWatches,
  setWatchStatus,
  expireOverdueWatches,
  type BccWatch,
} from "./bcc-watch";

/** Strip leading Re:/Fwd: markers and collapse whitespace for subject comparison. */
function normalizeSubject(subject: string): string {
  return subject
    .toLowerCase()
    .replace(/^(\s*(re|fwd|fw)\s*:\s*)+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function subjectMatches(candidate: string, original: string): boolean {
  const c = normalizeSubject(candidate);
  const o = normalizeSubject(original);
  if (!o) return false;
  return c === o || c.includes(o) || o.includes(c);
}

function watchMatchesCandidate(watch: BccWatch, candidate: GmailMessageMeta): boolean {
  const fromAddr = extractEmailAddress(candidate.from);
  if (fromAddr !== watch.recipient_addr.toLowerCase()) return false;
  return subjectMatches(candidate.subject, watch.original_subject);
}

export type BccWatchPassResult = { drafted: number };

/**
 * Run the BCC-watch pass for one owner over the messages collected this cron cycle. Returns the
 * number of replies drafted. Fast no-op when the owner has no open watches.
 */
export async function runBccWatchPass(params: {
  userId: string;
  candidates: GmailMessageMeta[];
}): Promise<BccWatchPassResult> {
  // Housekeeping: expire overdue watches first (cheap, and keeps the open set tight).
  await expireOverdueWatches(params.userId);

  const open = await fetchOpenWatches(params.userId);
  if (!open.ok || open.data.length === 0) return { drafted: 0 };

  const paResult = await fetchPaUser(params.userId);
  const paUser = paResult.ok ? paResult.data : null;
  if (!paUser?.anthropic_api_key) return { drafted: 0 }; // can't draft without a key

  const remaining = [...open.data];
  let drafted = 0;

  for (const candidate of params.candidates) {
    const idx = remaining.findIndex((w) => watchMatchesCandidate(w, candidate));
    if (idx === -1) continue;
    const watch = remaining[idx];

    const brief =
      `Write my reply to ${watch.recipient_addr}, who just responded to my earlier email ` +
      `"${watch.original_subject}". Their reply: "${candidate.snippet}". ` +
      `Keep it in my voice, address what they said, and move the conversation forward.`;

    let draftText: string;
    try {
      const result = await generateEmailDraft(
        { recipient: watch.recipient_addr, relationship: "", purpose: "", keyPoints: "", tone: "", brief },
        paUser.anthropic_api_key,
        paUser.brain_repo,
        paUser.github_token,
      );
      draftText = result.draft;
    } catch {
      // Drafting failed for this candidate — leave the watch open to retry next cycle.
      continue;
    }
    if (!draftText.trim()) continue;

    const subject = candidate.subject.toLowerCase().startsWith("re:")
      ? candidate.subject
      : `Re: ${watch.original_subject}`;

    const staged = await createInboxItem({
      userId: params.userId,
      kind: "draft",
      title: `Reply to ${watch.recipient_addr}`,
      bodyMd: draftText,
      source: "email-drafter",
      payload: {
        to: watch.recipient_addr,
        subject,
        body: draftText,
        threadId: candidate.threadId,
        inReplyTo: candidate.rfcMessageId,
        sourceSurface: "bcc-reply",
      },
    });
    if (!staged.ok) continue; // keep the watch open; next cycle retries

    await setWatchStatus(watch.id, "reply-drafted");
    remaining.splice(idx, 1);
    drafted += 1;
    if (remaining.length === 0) break;
  }

  return { drafted };
}
