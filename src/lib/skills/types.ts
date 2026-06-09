// types.ts — the shared vocabulary of Skills (PA-SKILL-1..7, Skills SPEC v1).
//
// A Skill is a reusable technique the agent has accumulated — one move, learned from a
// successful run. It lives as markdown in the owner's brain repo at
// `skills/<slug>/SKILL.md` (PA-SKILL-1: files, not a database). The frontmatter declared
// here is the contract two readers share: the dispatcher matches on `description` +
// `whenToUse` before planning (PA-SKILL-6), and the owner reads the same file in the
// Skills tab. Every value that crosses the brain or an API boundary is Zod-validated so a
// hand-edited or LLM-proposed SKILL.md fails soft (sensible defaults), never with `any`.

import { z } from "zod";

// ── Brain paths ───────────────────────────────────────────────────────────────────────────

/** Root of the Skills tree in the brain repo. Also the RAG zone path for matching. */
export const SKILLS_ROOT = "skills";

/** Kebab-case slug = directory name + stable id. Never changes once created (rename = new Skill). */
export function skillSlugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "skill";
}

export function skillDir(slug: string): string {
  return `${SKILLS_ROOT}/${slug}`;
}
export function skillPath(slug: string): string {
  return `${skillDir(slug)}/SKILL.md`;
}
export function skillVersionPath(slug: string, version: number): string {
  return `${skillDir(slug)}/versions/v${version}.md`;
}
export function skillTriggeredDir(slug: string): string {
  return `${skillDir(slug)}/triggered`;
}
/** A triggered-run record path. Stamp is passed in (deterministic; callers never call Date in helpers). */
export function skillTriggeredPath(slug: string, dateIso: string, runId: string): string {
  const day = dateIso.slice(0, 10);
  const safeRun = runId.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 60);
  return `${skillTriggeredDir(slug)}/${day}-${safeRun}.md`;
}

/** Pull the slug out of a `skills/<slug>/SKILL.md` path, or null if it isn't one. */
export function slugFromSkillPath(path: string): string | null {
  const m = path.match(/^skills\/([^/]+)\/SKILL\.md$/);
  return m ? m[1] : null;
}

// ── Frontmatter / data model (§8) ───────────────────────────────────────────────────────

// Outcomes a triggered run can report back to the Skill (drives the LEARN feedback loop).
export const SKILL_OUTCOMES = ["approved", "rejected", "edited", "read"] as const;
export const SkillOutcomeSchema = z.enum(SKILL_OUTCOMES);
export type SkillOutcome = z.infer<typeof SkillOutcomeSchema>;

// A paired input→output sample from a REAL run (never invented). The LEARN phase appends here.
export const SkillExampleSchema = z.object({
  runId: z.string().max(120).default(""),
  date: z.string().max(40).default(""),
  input: z.string().max(600).default(""),
  output: z.string().max(600).default(""),
  outcome: SkillOutcomeSchema.default("approved"),
});
export type SkillExample = z.infer<typeof SkillExampleSchema>;

// The compounding-evidence block: when it was learned, how often it has worked, how many
// owner approvals it has earned, the current version, and the per-Skill auto-evolve toggle.
export const SkillEvolutionSchema = z.object({
  createdAt: z.string().max(40).default(""),
  lastEvolvedAt: z.string().max(40).default(""),
  evolvedFromRuns: z.array(z.string().max(120)).max(50).default([]),
  successCount: z.number().int().nonnegative().default(0),
  ownerApprovalsCount: z.number().int().nonnegative().default(0),
  version: z.number().int().positive().default(1),
  // Per-Skill, never global, never applies to new-Skill creation (PA-SKILL-3).
  autoEvolve: z.boolean().default(false),
});
export type SkillEvolution = z.infer<typeof SkillEvolutionSchema>;

export const SkillFrontmatterSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(60),
  // The dispatcher's primary match target (§7.2) — keep it tight, one line.
  description: z.string().max(400).default(""),
  // The applicability boundary, including when NOT to use it. Second-priority match target.
  whenToUse: z.string().max(600).default(""),
  prerequisites: z.array(z.string().max(300)).max(20).default([]),
  // The ContainmentGuard scope (PA-SKILL-7) — a zone key from brain-containment.json.
  zone: z.string().min(1).max(120).default("project-shared"),
  examples: z.array(SkillExampleSchema).max(20).default([]),
  evolution: SkillEvolutionSchema.default(() => SkillEvolutionSchema.parse({})),
});
export type SkillFrontmatter = z.infer<typeof SkillFrontmatterSchema>;

/** A full Skill: the parsed frontmatter plus the markdown body that IS the technique (§8.2). */
export type Skill = {
  frontmatter: SkillFrontmatter;
  body: string;
};

/** A list-view summary (Skills tab + dispatcher candidate set) — never carries the full body. */
export type SkillSummary = {
  slug: string;
  name: string;
  description: string;
  whenToUse: string;
  zone: string;
  version: number;
  successCount: number;
  ownerApprovalsCount: number;
  lastEvolvedAt: string;
  createdAt: string;
  autoEvolve: boolean;
};

export function summaryOf(fm: SkillFrontmatter): SkillSummary {
  return {
    slug: fm.slug,
    name: fm.name,
    description: fm.description,
    whenToUse: fm.whenToUse,
    zone: fm.zone,
    version: fm.evolution.version,
    successCount: fm.evolution.successCount,
    ownerApprovalsCount: fm.evolution.ownerApprovalsCount,
    lastEvolvedAt: fm.evolution.lastEvolvedAt,
    createdAt: fm.evolution.createdAt,
    autoEvolve: fm.evolution.autoEvolve,
  };
}

// ── ContainmentGuard zone scoping (PA-SKILL-7) ────────────────────────────────────────────

/**
 * Whether a Skill in `skillZone` may be loaded by a run scoped to `runZone`. Exact-zone match,
 * fail closed — symmetric with assertPathInZone (brain/containment-guard). This is what makes
 * a public-persona sub-agent (zone `persona-<public>`) structurally unable to reach the owner's
 * `project-shared` or `user-private` Skills, and a `user-private` technique unreachable from a
 * `persona-vsm` run. Cross-zone Skill use is blocked here, before the LLM ever sees the file.
 */
export function skillReachableFromZone(skillZone: string, runZone: string): boolean {
  return skillZone.trim() === runZone.trim() && skillZone.trim().length > 0;
}

// ── Tunables (§7.2) ───────────────────────────────────────────────────────────────────────

/** Hard cap on Skills loaded into one run's spec, so a sprawling skills/ dir can't blow the
 *  sub-agent's context budget. Default 3 (PA_SKILLS_MAX_LOADED_PER_RUN). */
export function maxSkillsLoadedPerRun(): number {
  const raw = Number(process.env.PA_SKILLS_MAX_LOADED_PER_RUN);
  return Number.isFinite(raw) && raw > 0 ? Math.min(Math.floor(raw), 10) : 3;
}

/** Owner-approval count of evolution proposals for a Skill before PA offers per-Skill
 *  auto-evolve (PA-ORCH-4 trust-window pattern, PA-SKILL-3). */
export function autoEvolveTrustThreshold(): number {
  const raw = Number(process.env.PA_SKILLS_AUTO_EVOLVE_TRUST_THRESHOLD);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 3;
}
