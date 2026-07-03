// stage-approval.ts — §19 step 6: stage the WHOLE composed agent as ONE agent_builder_proposal
// card in Mission Control. The card's payload carries the full ComposedAgent (including the
// candidate Skill draft when one exists) so the owner reads exactly what they're approving —
// and can edit the persona name + starter prompt inline before saying yes. Reject → nothing
// persisted beyond the build row's status.

import { createInboxItem } from "@/lib/pa-inbox-items";
import { appsByIds, sanitizeAppIds } from "@/lib/apps/catalog";
import { starterSkillBySlug } from "@/lib/starter-skills/catalog";
import { updateAgentBuild } from "./db";
import { gatedAppsSentence, type GatedAppOffer } from "./gated-apps";
import {
  AGENT_BUILDER_PROPOSAL_KIND,
  AGENT_BUILDER_SOURCE,
  type ComposedAgent,
} from "./types";
import { agentBuilderLog } from "./log";

export type StageAgentBuildResult =
  | { ok: true; inboxItemId: string }
  | { ok: false; status: number; error: string };

/** The owner-readable summary the card renders (body_md). Voice-checked per §19. */
export function proposalBodyMarkdown(
  composed: ComposedAgent,
  gatedApps: readonly GatedAppOffer[] = [],
): string {
  const appLabels = appsByIds(sanitizeAppIds(composed.apps)).map((a) => a.label);
  const skillNames = composed.skillSlugs.map((slug) => starterSkillBySlug(slug)?.name ?? slug);

  const lines: string[] = [
    `**The job:** ${composed.intent.summary}`,
    "",
    `**Persona:** ${composed.personaName} (from the ${composed.personaTemplateKey} template)`,
    `**Apps it can use:** ${appLabels.length > 0 ? appLabels.join(", ") : "none"}`,
    `**Skills it starts with:** ${skillNames.length > 0 ? skillNames.join(", ") : "none"}`,
    `**Brain zones it may read:** ${composed.brainScopes.length > 0 ? composed.brainScopes.join(", ") : "none"}`,
    `**Schedule:** ${composed.schedule ?? "on demand"}`,
  ];

  if (composed.candidateSkill) {
    lines.push(
      "",
      `**New candidate Skill:** ${composed.candidateSkill.name} — a technique this agent needs that isn't in your Skill pack yet. It ships only if you approve this card, and the file lands in your repo only after you approve the commit.`,
    );
  }

  // PA-POS-34: the tier gate applies to the composed spec, priced right here — never a block.
  if (gatedApps.length > 0) {
    lines.push("", gatedAppsSentence(gatedApps));
  }

  lines.push(
    "",
    "Approve and Pocket Agent stages the commit that writes this agent into your Business Brain repo. The agent lives in your Business Brain repo. Not our database. Reject and nothing is saved.",
  );

  return lines.join("\n");
}

/**
 * Writes the ONE approval card and flips the build row to awaiting_approval. The inbox row is
 * the source of truth for the approval; the build row records the composition for the ledger
 * and the App surface.
 */
export async function stageAgentBuildApproval(params: {
  ownerId: string;
  composed: ComposedAgent;
  /** Composed Apps the owner's tier/passes haven't unlocked (PA-POS-34) — rendered on the
   *  card with a Project Pass offer per App; the owner can approve a scoped version. */
  gatedApps?: readonly GatedAppOffer[];
}): Promise<StageAgentBuildResult> {
  const { ownerId, composed } = params;
  const gatedApps = params.gatedApps ?? [];

  const inbox = await createInboxItem({
    userId: ownerId,
    kind: AGENT_BUILDER_PROPOSAL_KIND,
    title: `New agent for your approval: ${composed.personaName}`,
    bodyMd: proposalBodyMarkdown(composed, gatedApps),
    source: AGENT_BUILDER_SOURCE,
    payload: {
      buildId: composed.buildId,
      composed,
      gatedApps,
    } as unknown as Record<string, unknown>,
  });
  if (!inbox.ok) {
    agentBuilderLog.error("staging the approval card failed", {
      ownerId,
      buildId: composed.buildId,
      status: inbox.status,
      error: inbox.error,
    });
    return { ok: false, status: inbox.status, error: inbox.error };
  }

  const updated = await updateAgentBuild({
    id: composed.buildId,
    ownerId,
    patch: {
      status: "awaiting_approval",
      approval_inbox_item_id: inbox.data.id,
      parsed_intent: composed.intent as unknown as Record<string, unknown>,
      composed_persona_slug: composed.personaSlug,
      composed_apps: composed.apps,
      composed_skill_slugs: composed.skillSlugs,
      composed_brain_scopes: composed.brainScopes,
    },
  });
  if (!updated.ok) {
    agentBuilderLog.error("build row update after staging failed", {
      ownerId,
      buildId: composed.buildId,
      status: updated.status,
      error: updated.error,
    });
    return { ok: false, status: updated.status, error: updated.error };
  }

  return { ok: true, inboxItemId: inbox.data.id };
}
