// skills.ts — the two LEARN-phase Skills LinkedIn Scout emits (SPEC §9, Pocket_Agent_Skills_SPEC_v1).
//
// When a run's outreach starts landing — a connect-note acceptance rate crossing the threshold, or the
// day-7 follow-up earning replies — PA proposes the winning technique as a Skill so it sharpens every
// future agent that works LinkedIn. NEVER auto-written: each proposal stages a skill_evolution_proposal
// Approval Queue card (the same primitive lib/skills/learn.ts uses), and the per-Skill three-approval
// trust ladder unlocks auto-write later. Re-proposal is suppressed once the owner has the pending card
// or has rejected it, matching learn.ts's isProposalSuppressed.

import { createInboxItem, listInboxItems, type InboxItem } from "@/lib/pa-inbox-items";
import { listProspects } from "./db";

/** The acceptance/response rate a run must clear before PA proposes the technique (SPEC §9: > 40%). */
export const SKILL_PROPOSE_THRESHOLD = 0.4;
/** Minimum sample before a rate is trustworthy — don't propose a Skill off two lucky sends. */
export const SKILL_MIN_SAMPLE = 5;

export const CONNECT_SKILL_SLUG = "linkedin-connect-note-cold";
export const DAY7_SKILL_SLUG = "linkedin-day7-followup-warm";

type ProposeResult = { proposed: string[]; skipped: string[] };

/** True when this exact Skill proposal is already pending or was rejected — don't re-propose (mirrors
 *  learn.ts::isProposalSuppressed). */
function isSuppressed(slug: string, existing: InboxItem[]): boolean {
  return existing.some((item) => {
    if (item.kind !== "skill_evolution_proposal") return false;
    if (item.status !== "pending" && item.status !== "rejected") return false;
    return (item.payload as { slug?: unknown }).slug === slug;
  });
}

const SKILL_BODIES: Record<string, { name: string; description: string; whenToUse: string; body: string }> = {
  [CONNECT_SKILL_SLUG]: {
    name: "LinkedIn connect-note (cold)",
    description: "How to write a first-connect note that gets accepted.",
    whenToUse: "Drafting a LinkedIn connection-request note to a cold prospect (300-char cap).",
    body: [
      "1. Lead with ONE specific, true detail from their profile — the thing that made them worth reaching out to.",
      "2. Say why you're connecting in plain terms. No pitch, no link, no ask beyond connecting.",
      "3. Stay under 300 characters. Count them.",
      "4. Sound like a person, not a template. Refuse anything that reads like mass outreach — no 'let's connect and explore synergies'.",
    ].join("\n"),
  },
  [DAY7_SKILL_SLUG]: {
    name: "LinkedIn day-7 follow-up (warm)",
    description: "How to write the day-7 follow-up that gets replies.",
    whenToUse: "Following up on a LinkedIn message that's gone unanswered for about a week.",
    body: [
      "1. Acknowledge the gap without guilt-tripping — one short line.",
      "2. Add one fresh, specific reason to reply now (a new angle, not a repeat of the first message).",
      "3. Keep the ask tiny. Two or three sentences total.",
      "4. Refuse hype and pressure. If it reads pushy, cut it.",
    ].join("\n"),
  },
};

function proposalCardBody(slug: string, rate: number, sample: number): string {
  const meta = SKILL_BODIES[slug];
  return [
    `Pocket Agent wants to remember a technique: **${meta.name}**.`,
    "",
    `Your LinkedIn Scout outreach is landing — ${Math.round(rate * 100)}% across ${sample} sends. Worth baking the move into your brain.`,
    "",
    `_What it's for:_ ${meta.description}`,
    "",
    "Approve to save it to your brain, edit it first, or reject it.",
    "",
    "---",
    "",
    meta.body,
  ].join("\n");
}

async function stakeProposal(ownerId: string, slug: string, rate: number, sample: number): Promise<boolean> {
  const meta = SKILL_BODIES[slug];
  const created = await createInboxItem({
    userId: ownerId,
    kind: "skill_evolution_proposal",
    title: `New skill: ${meta.name}`,
    bodyMd: proposalCardBody(slug, rate, sample),
    source: "linkedin-scout",
    payload: {
      action: "new",
      slug,
      name: meta.name,
      proposedBody: meta.body,
      proposedDescription: meta.description,
      proposedWhenToUse: meta.whenToUse,
      proposedPrerequisites: [],
      proposedZone: "project-shared",
      currentVersion: 0,
      reason: `LinkedIn Scout outreach acceptance ${Math.round(rate * 100)}% over ${sample} sends.`,
    },
  });
  return created.ok;
}

/**
 * Best-effort: inspect the owner's LinkedIn Scout prospects and, when a technique's rate clears the
 * threshold on a big-enough sample, propose the matching Skill (once). Never throws — a LEARN failure
 * must never break the send it followed. Returns which slugs were proposed vs skipped, for logging.
 */
export async function maybeProposeLinkedinSkills(ownerId: string): Promise<ProposeResult> {
  const out: ProposeResult = { proposed: [], skipped: [] };

  const prospectsRes = await listProspects(ownerId);
  if (!prospectsRes.ok) return out;
  const prospects = prospectsRes.data;

  // Connect-note acceptance: of the connection notes sent, how many were accepted.
  const connSent = prospects.filter((p) => p.connection_status !== "pending").length;
  const connAccepted = prospects.filter((p) => p.connection_status === "accepted").length;
  // Day-7: of the day-7 follow-ups sent, use acceptance as the reply proxy (we don't track replies yet).
  const day7Sent = prospects.filter((p) => p.day7_followup_status === "sent").length;
  const day7Landed = prospects.filter(
    (p) => p.day7_followup_status === "sent" && p.connection_status === "accepted",
  ).length;

  const existingRes = await listInboxItems(ownerId);
  const existing = existingRes.ok ? existingRes.data : [];

  if (connSent >= SKILL_MIN_SAMPLE && connAccepted / connSent > SKILL_PROPOSE_THRESHOLD) {
    if (isSuppressed(CONNECT_SKILL_SLUG, existing)) out.skipped.push(CONNECT_SKILL_SLUG);
    else if (await stakeProposal(ownerId, CONNECT_SKILL_SLUG, connAccepted / connSent, connSent))
      out.proposed.push(CONNECT_SKILL_SLUG);
  }

  if (day7Sent >= SKILL_MIN_SAMPLE && day7Landed / day7Sent > SKILL_PROPOSE_THRESHOLD) {
    if (isSuppressed(DAY7_SKILL_SLUG, existing)) out.skipped.push(DAY7_SKILL_SLUG);
    else if (await stakeProposal(ownerId, DAY7_SKILL_SLUG, day7Landed / day7Sent, day7Sent))
      out.proposed.push(DAY7_SKILL_SLUG);
  }

  return out;
}
