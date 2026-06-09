// sweep.ts — the Follow-Up Sweeps orchestrator (PA-FUS-4).
//
// One sweep, one source: discover the dormant contacts, persist them (upsert preserves a "leave
// alone" flag and the re-draft cooldown), draft the next touch for each contact that isn't suppressed
// or inside its cooldown, and stage one follow_up_sweep_batch summary card next to the per-contact
// 'draft' cards. The weekly cron (/api/cron/followup-sweeps, Sunday 8am) calls sweepSource for every
// due source; the dashboard's "Sweep now" calls it for one. Service-role throughout — the cron has no
// user session and threads each source's owner_id through.

import { createInboxItem } from "@/lib/pa-inbox-items";
import { discoverDormantContacts } from "./discover";
import { draftFollowupForContact, type PaUserLite, type StagedFollowup } from "./draft";
import { listContactsForSource, markSourceSwept, upsertContact } from "./db";
import { SOURCE_TYPE_LABEL, type FollowupSweepSource } from "./types";

export type SweepSummary = {
  sourceId: string;
  label: string;
  discovered: number;
  staged: StagedFollowup[];
  /** Contacts skipped because they're inside the 7-day re-draft cooldown. */
  skippedCooldown: number;
  /** Contacts skipped because the owner marked them "leave alone". */
  suppressed: number;
};

type SweepResult =
  | { ok: true; data: SweepSummary }
  | { ok: false; status: number; error: string };

// One messages.get-bounded discovery can surface many contacts; cap drafts per sweep so a single
// source can't flood Mission Control (and the owner's Anthropic bill) in one run.
const MAX_DRAFTS_PER_SWEEP = 25;

/** Crypto-random per-sweep id — makes each draft's cost idempotency key deterministic within a run. */
function newSweepId(): string {
  return globalThis.crypto.randomUUID();
}

function buildBatchCard(summary: SweepSummary, source: FollowupSweepSource): string {
  const lines: string[] = [
    `**${SOURCE_TYPE_LABEL[source.source_type]}** · ${source.source_config.label}`,
    "",
    `Swept for contacts not touched in ${source.dormancy_days} days. Found ${summary.discovered}, drafted ${summary.staged.length}.`,
    "",
  ];
  if (summary.staged.length) {
    lines.push("**Drafts staged — review and send from your Inbox**", "");
    for (const d of summary.staged) {
      lines.push(`- **${d.contactName || d.contactEmail}** — ${d.bodyPreview}`);
    }
  } else {
    lines.push("_No new drafts this sweep — everyone's either been contacted recently or left alone._");
  }
  if (summary.skippedCooldown > 0 || summary.suppressed > 0) {
    lines.push(
      "",
      `_Skipped ${summary.skippedCooldown} drafted in the last 7 days, ${summary.suppressed} left alone._`,
    );
  }
  return lines.join("\n");
}

/**
 * Sweep one source end to end. Discovery failures (no Gmail grant, empty brain folder) return an
 * error rather than staging an empty card; a successful sweep with zero dormant contacts still stages
 * a batch card so the owner sees it ran. Advances the source's sweep cursor on the way out.
 */
export async function sweepSource(params: {
  source: FollowupSweepSource;
  ownerId: string;
  paUser: PaUserLite;
}): Promise<SweepResult> {
  const { source, ownerId, paUser } = params;
  const sweepId = newSweepId();

  const discovered = await discoverDormantContacts(source, ownerId, {
    brain_repo: paUser.brain_repo,
    github_token: paUser.github_token,
  });
  if (!discovered.ok) {
    // Advance the cursor even on a discovery failure, so a broken source doesn't get re-picked every
    // tick — it retries on its normal weekly cadence.
    await markSourceSwept(source.id);
    return { ok: false, status: 422, error: discovered.reason };
  }

  // Persist every discovered contact (upsert keeps suppressed + last_drafted_at), and remember each
  // one's discovery note so the drafter can fold the real facts into the email.
  const noteByEmail = new Map<string, string>();
  for (const c of discovered.contacts) {
    noteByEmail.set(c.contactEmail, c.note);
    await upsertContact({
      ownerId,
      sourceId: source.id,
      contactEmail: c.contactEmail,
      contactName: c.contactName,
      lastTouchedAt: c.lastTouchedAt,
    });
  }

  // Re-read the persisted rows so we draft against the source of truth (suppressed flag + cooldown).
  const contactsResult = await listContactsForSource(source.id, ownerId);
  if (!contactsResult.ok) {
    await markSourceSwept(source.id);
    return { ok: false, status: contactsResult.status, error: contactsResult.error };
  }
  // Only the contacts this sweep actually rediscovered (a source can accumulate history).
  const discoveredEmails = new Set(discovered.contacts.map((c) => c.contactEmail));
  const candidates = contactsResult.data.filter((c) => discoveredEmails.has(c.contact_email));

  const summary: SweepSummary = {
    sourceId: source.id,
    label: source.source_config.label,
    discovered: discovered.contacts.length,
    staged: [],
    skippedCooldown: 0,
    suppressed: 0,
  };

  for (const contact of candidates) {
    if (summary.staged.length >= MAX_DRAFTS_PER_SWEEP) break;
    if (contact.suppressed) {
      summary.suppressed += 1;
      continue;
    }
    const result = await draftFollowupForContact({
      contact,
      source,
      ownerId,
      paUser,
      sweepId,
      note: noteByEmail.get(contact.contact_email),
    });
    if (!result.ok) continue; // one contact failing doesn't sink the sweep
    if (result.data) summary.staged.push(result.data);
    else summary.skippedCooldown += 1; // inside the 7-day cooldown
  }

  // Stage the batch summary card (PA-FUS-4) — informational, alongside the per-contact draft cards.
  await createInboxItem({
    userId: ownerId,
    kind: "follow_up_sweep_batch",
    title: `Follow-up sweep: ${source.source_config.label}`,
    bodyMd: buildBatchCard(summary, source),
    source: "follow-up-sweeps",
    payload: {
      sourceId: source.id,
      sourceType: source.source_type,
      relationship: source.source_config.relationship,
      discovered: summary.discovered,
      stagedCount: summary.staged.length,
      skippedCooldown: summary.skippedCooldown,
      suppressed: summary.suppressed,
      contacts: summary.staged.map((d) => ({
        contactId: d.contactId,
        email: d.contactEmail,
        name: d.contactName,
        subject: d.subject,
        inboxItemId: d.inboxItemId,
      })),
    },
  });

  await markSourceSwept(source.id);
  return { ok: true, data: summary };
}
