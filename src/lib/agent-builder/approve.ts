// approve.ts — the approval callback for an agent_builder_proposal card. On approve:
//
//   1. Create the Persona from the composed template (the shipped createPersonaFromTemplate
//      sequence — spec into the owner's brain repo, ContainmentGuard zone, personas row).
//      The agent is live in the workspace with its composed accessible_apps.
//   2. Stage ONE push_files build action via the shipped GitHub Build connector carrying the
//      agent bundle (AGENT.md + persona.md + the candidate Skill file when one was drafted).
//      push_files is ALWAYS single-approval (PA-BUILD SPEC §11) — the owner reads the exact
//      files before they land in their Business Brain repo.
//   3. Flip the pa_agent_builds row to approved.
//
// On reject (the reject route): the build row flips to rejected and nothing else exists —
// no persona, no files, no Skill.

import { z } from "zod";
import { fetchPaUser } from "@/lib/pa-supabase";
import { getTemplate } from "@/lib/personas/templates";
import { createPersonaFromTemplate } from "@/lib/personas/create";
import { PersonaDbError } from "@/lib/personas/db";
import { TONE_KEYS, type ToneKey } from "@/lib/personas/types";
import { sanitizeAppIds } from "@/lib/apps/catalog";
import { stageConnectorAction } from "@/lib/orchestrator/tool-use";
import { GITHUB_BUILD_CONNECTOR } from "@/lib/connectors/github-build/actions";
import { fetchGithubBuildConnectionFull } from "@/lib/pa-github-build-connections";
import { updateAgentBuild } from "./db";
import { buildAgentBundleFiles } from "./files";
import { ComposedAgentSchema, type ComposedAgent } from "./types";
import { agentBuilderLog } from "./log";

// The card payload, validated at the boundary (repo rule — never trust a stored payload).
const ProposalPayloadSchema = z.object({
  buildId: z.string().min(1).max(80),
  composed: ComposedAgentSchema,
});

// Inline edits the owner made on the card before approving.
export type AgentBuildOverrides = {
  personaName?: string;
  starterPrompt?: string;
};

export type AcceptAgentBuildResult =
  | { ok: true; personaSlug: string; pushInboxItemId: string }
  | { ok: false; status: number; error: string };

function toneOf(value: string, fallback: ToneKey): ToneKey {
  return (TONE_KEYS as readonly string[]).includes(value) ? (value as ToneKey) : fallback;
}

function applyOverrides(
  composed: ComposedAgent,
  overrides: AgentBuildOverrides,
): ComposedAgent {
  const personaName = overrides.personaName?.trim() || composed.personaName;
  const starterPrompt = overrides.starterPrompt?.trim() || composed.starterPrompt;
  return { ...composed, personaName, starterPrompt };
}

export async function acceptAgentBuildProposal(params: {
  ownerId: string;
  payload: Record<string, unknown>;
  overrides: AgentBuildOverrides;
}): Promise<AcceptAgentBuildResult> {
  const parsed = ProposalPayloadSchema.safeParse(params.payload);
  if (!parsed.success) {
    return {
      ok: false,
      status: 422,
      error: "This proposal's payload is unreadable — compose the agent again.",
    };
  }
  const composed = applyOverrides(parsed.data.composed, params.overrides);

  const template = getTemplate(composed.personaTemplateKey);
  if (!template) {
    return {
      ok: false,
      status: 422,
      error: "This proposal references a persona template that no longer ships. Compose again.",
    };
  }

  const paRes = await fetchPaUser(params.ownerId);
  const pa = paRes.ok ? paRes.data : null;
  if (!pa?.brain_repo || !pa.github_token) {
    return {
      ok: false,
      status: 409,
      error: "Connect your Business Brain in Settings before deploying an agent.",
    };
  }

  // The push rides the GitHub Build connector — check it's connected BEFORE creating the
  // persona so a half-deployed agent can't happen.
  const buildConn = await fetchGithubBuildConnectionFull(params.ownerId);
  if (!buildConn.ok || !buildConn.data || buildConn.data.status === "revoked") {
    return {
      ok: false,
      status: 409,
      error:
        "Connect GitHub Build in Settings → Connections first — that's how the composed agent gets written into your own repo.",
    };
  }

  // 1. The persona goes live in the workspace (spec file + zone + row, the shipped sequence).
  let personaSlug: string;
  try {
    const created = await createPersonaFromTemplate({
      ctx: { userId: params.ownerId, brainRepo: pa.brain_repo, githubToken: pa.github_token },
      template,
      name: composed.personaName,
      tone: toneOf(composed.tone, template.defaultTone),
      customFields: composed.customFields,
      apps: sanitizeAppIds(composed.apps),
    });
    if (!created.ok) {
      return { ok: false, status: created.status, error: created.error };
    }
    personaSlug = created.persona.slug;
  } catch (e) {
    if (e instanceof PersonaDbError && (e.status === 409 || /duplicate|23505/.test(e.message))) {
      return {
        ok: false,
        status: 409,
        error: `A persona named "${composed.personaName}" already exists. Edit the card and rename it.`,
      };
    }
    throw e;
  }

  // 2. Stage the push_files build action carrying the agent bundle. Always single-approval —
  //    the owner reads the exact files before they land.
  const approvedAtIso = new Date().toISOString();
  const bundle = buildAgentBundleFiles({ ...composed, personaSlug }, approvedAtIso);
  let pushInboxItemId: string;
  try {
    const staged = await stageConnectorAction({
      userId: params.ownerId,
      subAgentRunId: null,
      connector: GITHUB_BUILD_CONNECTOR,
      action: "push_files",
      payload: {
        repo: pa.brain_repo,
        branch: "main",
        files: bundle.map((f) => ({ path: f.path, content: f.content })),
        message: `agent-builder: add ${composed.personaName}`,
      },
      declaredScopes: [GITHUB_BUILD_CONNECTOR],
      title: `Commit "${composed.personaName}" to your Business Brain repo`,
      preview:
        `Pocket Agent will commit ${bundle.length} file${bundle.length === 1 ? "" : "s"} ` +
        `(agent config + persona spec${composed.candidateSkill ? " + 1 candidate Skill" : ""}) ` +
        `to ${pa.brain_repo}. The agent lives in your Business Brain repo. Not our database.`,
      kind: "build_action_approval",
    });
    pushInboxItemId = staged.inboxItemId;
  } catch (e) {
    agentBuilderLog.error("staging push_files after persona create failed", {
      ownerId: params.ownerId,
      buildId: composed.buildId,
      error: e instanceof Error ? e.message : String(e),
    });
    return {
      ok: false,
      status: 502,
      error:
        "The persona was created, but staging the repo commit failed. Open Settings → Connections, confirm GitHub Build, and approve the agent again.",
    };
  }

  // 3. Record the approval on the build row (best-effort surface state — the card + staged
  //    action are the operative records; a failed patch logs loudly instead of undoing them).
  const updated = await updateAgentBuild({
    id: composed.buildId,
    ownerId: params.ownerId,
    patch: { status: "approved", composed_persona_slug: personaSlug },
  });
  if (!updated.ok) {
    agentBuilderLog.error("build row approve patch failed", {
      ownerId: params.ownerId,
      buildId: composed.buildId,
      status: updated.status,
      error: updated.error,
    });
  }

  return { ok: true, personaSlug, pushInboxItemId };
}

/** The reject side: flip the build row. Nothing else was ever persisted. */
export async function rejectAgentBuildProposal(params: {
  ownerId: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  const parsed = ProposalPayloadSchema.safeParse(params.payload);
  if (!parsed.success) return; // unreadable payload — nothing to flip
  const updated = await updateAgentBuild({
    id: parsed.data.buildId,
    ownerId: params.ownerId,
    patch: { status: "rejected" },
  });
  if (!updated.ok) {
    agentBuilderLog.warn("build row reject patch failed", {
      ownerId: params.ownerId,
      buildId: parsed.data.buildId,
      status: updated.status,
      error: updated.error,
    });
  }
}
