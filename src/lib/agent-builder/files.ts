// files.ts — the file bundle an approved agent build pushes into the owner's OWN Business
// Brain repo via the GitHub Build connector (push_files, always single-approval). This is the
// ownership story made literal: the composed agent's config is markdown in the customer's
// repo, not a row in PA's database. Three files at most:
//
//   agents/<slug>/AGENT.md   — the agent config: persona, apps, skills, brain scopes, schedule
//   agents/<slug>/persona.md — the composed persona spec (same markdown the workspace runs on)
//   skills/<slug>/SKILL.md   — the candidate Skill, only when the compose drafted one
//
// The candidate Skill file uses the shipped SKILL.md format (agentskills.io-compatible via
// serializeSkill) so it's a real, portable Skill the moment the owner approves the push.

import { serializeSkill } from "@/lib/skills/format";
import { SkillFrontmatterSchema, skillPath } from "@/lib/skills/types";
import { buildPersonaSpecMarkdown } from "@/lib/personas/spec";
import { applyTemplate, getTemplate } from "@/lib/personas/templates";
import type { ComposedAgent } from "./types";

export type AgentBundleFile = { path: string; content: string };

export function agentConfigPath(personaSlug: string): string {
  return `agents/${personaSlug}/AGENT.md`;
}

export function agentPersonaCopyPath(personaSlug: string): string {
  return `agents/${personaSlug}/persona.md`;
}

function yamlList(items: readonly string[]): string {
  return items.length === 0 ? "[]" : `[${items.join(", ")}]`;
}

function agentConfigMarkdown(composed: ComposedAgent, approvedAtIso: string): string {
  const lines = [
    "---",
    `name: "${composed.personaName.replace(/"/g, "'")}"`,
    `persona_slug: ${composed.personaSlug}`,
    `template: ${composed.personaTemplateKey}`,
    `apps: ${yamlList(composed.apps)}`,
    `skills: ${yamlList(composed.skillSlugs)}`,
    `brain_scopes: ${yamlList(composed.brainScopes)}`,
    `schedule: ${composed.schedule ? `"${composed.schedule.replace(/"/g, "'")}"` : "none"}`,
    `composed_by: pocket-agent-agent-builder`,
    `approved_at: ${approvedAtIso}`,
    "---",
    "",
    `# ${composed.personaName}`,
    "",
    "## The job, in the owner's words",
    "",
    composed.specText.trim(),
    "",
    "## What it watches",
    "",
    composed.intent.watches || "On-demand — runs when the owner asks.",
    "",
    "## What it does",
    "",
    composed.intent.does,
    "",
    "## First run",
    "",
    composed.starterPrompt,
    "",
    "## Provenance",
    "",
    "Composed by Pocket Agent from the spec above and approved by the owner in Mission",
    "Control. Every part is a shipped Pocket Agent primitive — a Persona template, Apps from",
    "the catalog, Skills from this repo. This file lives in the owner's Business Brain repo,",
    "not Pocket Agent's database.",
    "",
  ];
  return lines.join("\n");
}

/**
 * The push_files payload for an approved build. `approvedAtIso` is stamped by the approval
 * callback (the moment the owner said yes).
 */
export function buildAgentBundleFiles(
  composed: ComposedAgent,
  approvedAtIso: string,
): AgentBundleFile[] {
  const files: AgentBundleFile[] = [
    {
      path: agentConfigPath(composed.personaSlug),
      content: agentConfigMarkdown(composed, approvedAtIso),
    },
  ];

  // The persona spec copy — rebuilt from the same template + custom fields the workspace
  // persona was created from, so the repo copy and the running persona can't diverge at birth.
  const template = getTemplate(composed.personaTemplateKey);
  if (template) {
    const fields = applyTemplate({
      template,
      personaName: composed.personaName,
      customFields: composed.customFields,
    });
    files.push({
      path: agentPersonaCopyPath(composed.personaSlug),
      content: buildPersonaSpecMarkdown(fields),
    });
  }

  if (composed.candidateSkill) {
    const frontmatter = SkillFrontmatterSchema.parse({
      name: composed.candidateSkill.name,
      slug: composed.candidateSkill.slug,
      description: composed.candidateSkill.description,
      whenToUse: composed.candidateSkill.whenToUse,
      zone: "project-shared",
      evolution: { createdAt: approvedAtIso, version: 1 },
    });
    files.push({
      path: skillPath(composed.candidateSkill.slug),
      content: serializeSkill({ frontmatter, body: composed.candidateSkill.body }),
    });
  }

  return files;
}
