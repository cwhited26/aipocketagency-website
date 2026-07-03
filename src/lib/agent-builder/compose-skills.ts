// compose-skills.ts — §19 step 4: pull the starter Skills that match the parsed intent, and
// when a needed technique isn't in the shipped pack, DRAFT a candidate Skill that rides the
// same approval card. The candidate is never auto-registered — it only becomes a file in the
// owner's brain repo after (a) the owner approves the composed agent and (b) the owner
// approves the push_files build action that carries it (PA-BUILD single-approval rule).
//
// Deterministic keyword matching, same shape as the dispatcher's grep fallback
// (lib/skills/resolve.ts rankByGrep): no model call, predictable cost.

import { STARTER_SKILL_MANIFEST } from "@/data/starter-skills/manifest";
import { type CandidateSkill, type ParsedIntent } from "./types";

const MAX_MATCHED_SKILLS = 5;
// A technique whose best manifest score is below this drafts a candidate instead.
const CANDIDATE_THRESHOLD = 2;

function terms(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
}

function scoreAgainst(queryTerms: readonly string[], haystack: string, weight: number): number {
  const hay = haystack.toLowerCase();
  let hits = 0;
  for (const t of queryTerms) {
    if (hay.includes(t)) hits += 1;
  }
  return hits * weight;
}

function skillScore(queryTerms: readonly string[], record: {
  name: string;
  description: string;
  whenToUse: string;
}): number {
  return (
    scoreAgainst(queryTerms, record.name, 2) +
    scoreAgainst(queryTerms, record.description, 2) +
    scoreAgainst(queryTerms, record.whenToUse, 1)
  );
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function titleCase(text: string): string {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Drafts the candidate Skill for a technique the shipped pack doesn't cover. Deterministic
 * template — the body describes the technique's working loop over shipped primitives (read the
 * brain, do the pass, stage for approval), never executable code.
 */
export function draftCandidateSkill(params: {
  technique: string;
  intent: ParsedIntent;
}): CandidateSkill {
  const { technique, intent } = params;
  const cleanTechnique = technique.trim();
  return {
    slug: slugify(cleanTechnique),
    name: titleCase(cleanTechnique),
    description: `${titleCase(cleanTechnique)} — drafted for the "${intent.jobNoun}" agent from the owner's spec. Pending the owner's approval before it exists anywhere.`,
    whenToUse: `Use when the job calls for ${cleanTechnique.toLowerCase()}. The agent's job: ${intent.summary}`,
    body: [
      `# ${titleCase(cleanTechnique)}`,
      "",
      `Drafted by the Agent Builder for: ${intent.summary}`,
      "",
      "## The loop",
      "",
      `1. Read the relevant Business Brain zones first (${intent.brainZones.length > 0 ? intent.brainZones.join(", ") : "the zones this agent declares"}). Work from what the owner has taught — never invent facts, names, or numbers.`,
      `2. Apply the technique to the task at hand: ${intent.does}`,
      "3. Stage the output in Mission Control for the owner's approval. Nothing sends, posts, or commits until the owner says so.",
      "",
      "## Sharpen this Skill",
      "",
      "This is a first draft from the owner's spec. Edit it after the first few runs — the LEARN phase will propose sharpenings as real examples accumulate.",
    ].join("\n"),
  };
}

export type ComposedSkills = {
  skillSlugs: string[];
  candidateSkill: CandidateSkill | null;
};

/**
 * Matches the intent against the shipped starter pack (top 5 by keyword score) and drafts at
 * most ONE candidate Skill for the strongest unmatched technique. The Agent Builder is
 * Studio+/Enterprise-gated, so every starter Skill is tier-unlocked for its callers.
 */
export function composeSkills(intent: ParsedIntent): ComposedSkills {
  const queryTerms = terms(
    [intent.summary, intent.does, intent.watches, ...intent.neededTechniques].join(" "),
  );

  const ranked = STARTER_SKILL_MANIFEST.map((record) => ({
    slug: record.slug,
    score: skillScore(queryTerms, record),
  }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_MATCHED_SKILLS);

  // First technique the shipped pack doesn't cover → one candidate draft (never more; one
  // card stays reviewable).
  let candidateSkill: CandidateSkill | null = null;
  for (const technique of intent.neededTechniques) {
    const techniqueTerms = terms(technique);
    const best = Math.max(
      0,
      ...STARTER_SKILL_MANIFEST.map((record) => skillScore(techniqueTerms, record)),
    );
    if (best < CANDIDATE_THRESHOLD) {
      candidateSkill = draftCandidateSkill({ technique, intent });
      break;
    }
  }

  return { skillSlugs: ranked.map((r) => r.slug), candidateSkill };
}
