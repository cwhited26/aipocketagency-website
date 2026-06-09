// store.ts — the brain-repo I/O for Skills (PA-SKILL-1: the store is the owner's git repo, not
// a database). Mirrors how Personas knowledge + Scaffolds are stored. Every Skill is
// `skills/<slug>/SKILL.md` with a `versions/vN.md` history and a `triggered/` audit trail.
//
// Versioning convention (PA-SKILL-5): versions/vN.md holds the exact SKILL.md content of version
// N — every write commits both the version snapshot and the live SKILL.md. Roll-back is additive:
// it copies an old version's technique into a NEW version row, never a destructive overwrite. Same
// "a Skill that evolves badly is one tap from its last-good state" guarantee Scaffolds give.

import {
  commitMemoryFile,
  deleteRepoFile,
  fetchFileContent,
  listRepoTree,
} from "@/lib/pa-brain";
import { parseSkill, serializeSkill } from "./format";
import {
  skillPath,
  skillTriggeredDir,
  skillTriggeredPath,
  skillVersionPath,
  slugFromSkillPath,
  summaryOf,
  type Skill,
  type SkillFrontmatter,
  type SkillOutcome,
  type SkillSummary,
} from "./types";

// Bound on how many SKILL.md files we read when listing — far above any real skills/ dir.
const MAX_SKILLS = 60;
const MAX_TRIGGERED = 25;

export type SkillRepo = { repo: string; token: string | null };

// ── Reads ─────────────────────────────────────────────────────────────────────────────────

/** Lists every Skill in the brain (summaries only — never reads the full body). */
export async function listSkillSummaries(ctx: SkillRepo): Promise<SkillSummary[]> {
  const tree = await listRepoTree(ctx.repo, ctx.token);
  const skillPaths = tree
    .filter((e) => e.type === "blob" && slugFromSkillPath(e.path) !== null)
    .map((e) => e.path)
    .slice(0, MAX_SKILLS);

  const skills = await Promise.all(
    skillPaths.map(async (path) => {
      const raw = await fetchFileContent(ctx.repo, path, ctx.token);
      const parsed = raw ? parseSkill(raw) : null;
      return parsed ? summaryOf(parsed.frontmatter) : null;
    }),
  );
  return skills.filter((s): s is SkillSummary => s !== null);
}

/** Reads one Skill's live SKILL.md, or null if it doesn't exist / can't be parsed. */
export async function readSkill(ctx: SkillRepo, slug: string): Promise<Skill | null> {
  const raw = await fetchFileContent(ctx.repo, skillPath(slug), ctx.token);
  return raw ? parseSkill(raw) : null;
}

/** The version numbers that exist under skills/<slug>/versions/, newest first. */
export async function listSkillVersions(ctx: SkillRepo, slug: string): Promise<number[]> {
  const tree = await listRepoTree(ctx.repo, ctx.token);
  const prefix = `skills/${slug}/versions/`;
  const versions: number[] = [];
  for (const e of tree) {
    if (e.type !== "blob" || !e.path.startsWith(prefix)) continue;
    const m = e.path.slice(prefix.length).match(/^v(\d+)\.md$/);
    if (m) versions.push(Number(m[1]));
  }
  return versions.sort((a, b) => b - a);
}

export type TriggeredRecord = { path: string; date: string; summary: string };

/** Reads the triggered/ audit trail for a Skill (proof it's being used + LEARN feedback). */
export async function listTriggeredRecords(ctx: SkillRepo, slug: string): Promise<TriggeredRecord[]> {
  const tree = await listRepoTree(ctx.repo, ctx.token);
  const prefix = `${skillTriggeredDir(slug)}/`;
  const paths = tree
    .filter((e) => e.type === "blob" && e.path.startsWith(prefix) && e.path.endsWith(".md"))
    .map((e) => e.path)
    .sort((a, b) => (a < b ? 1 : -1))
    .slice(0, MAX_TRIGGERED);

  return Promise.all(
    paths.map(async (path) => {
      const raw = await fetchFileContent(ctx.repo, path, ctx.token);
      const first = raw.split("\n").find((l) => l.trim() && !l.startsWith("#")) ?? "";
      const day = path.slice(prefix.length, prefix.length + 10);
      return { path, date: day, summary: first.trim().slice(0, 200) };
    }),
  );
}

// ── Writes (versioned) ──────────────────────────────────────────────────────────────────────

type WriteResult = { ok: true; sha: string; version: number } | { ok: false; error: string };

function requireToken(ctx: SkillRepo): string | null {
  return ctx.token;
}

/** Commits a Skill at its current version: the versions/vN.md snapshot first, then the live
 *  SKILL.md (both with identical content). The version snapshot lands first so a failure can
 *  never leave a live SKILL.md with no recoverable history. */
async function commitSkill(ctx: SkillRepo, skill: Skill, message: string): Promise<WriteResult> {
  const token = requireToken(ctx);
  if (!token) return { ok: false, error: "Connect your brain (GitHub) to save Skills." };
  const content = serializeSkill(skill);
  const version = skill.frontmatter.evolution.version;

  const snap = await commitMemoryFile({
    repo: ctx.repo,
    token,
    path: skillVersionPath(skill.frontmatter.slug, version),
    mode: "replace",
    content,
    commitMessage: `skill: snapshot ${skill.frontmatter.slug} v${version}`,
  });
  if (!snap.ok) return snap;

  const live = await commitMemoryFile({
    repo: ctx.repo,
    token,
    path: skillPath(skill.frontmatter.slug),
    mode: "replace",
    content,
    commitMessage: message,
  });
  if (!live.ok) return live;
  return { ok: true, sha: live.sha, version };
}

export type SkillDraft = {
  name: string;
  slug: string;
  description: string;
  whenToUse: string;
  body: string;
  zone: string;
  prerequisites?: string[];
  examples?: SkillFrontmatter["examples"];
  // Approvals to seed (1 when the owner approves a LEARN proposal at creation; 0 for a hand-created
  // Skill that wasn't reviewed through the proposal flow).
  ownerApprovals?: number;
};

/** Creates a brand-new Skill (version 1). A new technique always gets reviewed once — never
 *  auto-evolved (PA-SKILL-3) — so auto_evolve starts false. */
export async function createSkill(
  ctx: SkillRepo,
  draft: SkillDraft,
  stampIso: string,
): Promise<WriteResult> {
  const skill: Skill = {
    frontmatter: {
      name: draft.name,
      slug: draft.slug,
      description: draft.description,
      whenToUse: draft.whenToUse,
      prerequisites: draft.prerequisites ?? [],
      zone: draft.zone,
      examples: draft.examples ?? [],
      evolution: {
        createdAt: stampIso,
        lastEvolvedAt: stampIso,
        evolvedFromRuns: [],
        successCount: 0,
        ownerApprovalsCount: draft.ownerApprovals ?? 0,
        version: 1,
        autoEvolve: false,
      },
    },
    body: draft.body,
  };
  return commitSkill(ctx, skill, `skill: create ${draft.slug}`);
}

/**
 * Evolves an existing Skill into a new version. The proposed `next` carries the refined
 * body/description/whenToUse/examples; the evolution counters (success/approvals/created_at)
 * are preserved from the live version and the version number is bumped. `fromRunId` is appended
 * to evolved_from_runs, and `bumpApprovals` adds one owner approval (the proposal was approved).
 */
export async function evolveSkill(
  ctx: SkillRepo,
  next: { body: string; description: string; whenToUse: string; examples?: SkillFrontmatter["examples"]; prerequisites?: string[] },
  current: Skill,
  stampIso: string,
  opts?: { fromRunId?: string; bumpApprovals?: boolean },
): Promise<WriteResult> {
  const ev = current.frontmatter.evolution;
  const evolvedFromRuns = opts?.fromRunId && !ev.evolvedFromRuns.includes(opts.fromRunId)
    ? [...ev.evolvedFromRuns, opts.fromRunId].slice(-50)
    : ev.evolvedFromRuns;

  const evolved: Skill = {
    frontmatter: {
      ...current.frontmatter,
      description: next.description || current.frontmatter.description,
      whenToUse: next.whenToUse || current.frontmatter.whenToUse,
      prerequisites: next.prerequisites ?? current.frontmatter.prerequisites,
      examples: next.examples ?? current.frontmatter.examples,
      evolution: {
        ...ev,
        lastEvolvedAt: stampIso,
        evolvedFromRuns,
        ownerApprovalsCount: ev.ownerApprovalsCount + (opts?.bumpApprovals ? 1 : 0),
        version: ev.version + 1,
      },
    },
    body: next.body,
  };
  return commitSkill(ctx, evolved, `skill: evolve ${current.frontmatter.slug} → v${evolved.frontmatter.evolution.version}`);
}

/** Rolls a Skill back to a prior version by writing its technique into a NEW version row
 *  (additive, never destructive — PA-SKILL-5). Returns an error if either version is missing. */
export async function rollbackSkill(
  ctx: SkillRepo,
  slug: string,
  targetVersion: number,
  stampIso: string,
): Promise<WriteResult> {
  const current = await readSkill(ctx, slug);
  if (!current) return { ok: false, error: "Skill not found." };
  const snapRaw = await fetchFileContent(ctx.repo, skillVersionPath(slug, targetVersion), ctx.token);
  const target = snapRaw ? parseSkill(snapRaw) : null;
  if (!target) return { ok: false, error: `Version v${targetVersion} not found.` };

  return evolveSkill(
    ctx,
    {
      body: target.body,
      description: target.frontmatter.description,
      whenToUse: target.frontmatter.whenToUse,
      examples: target.frontmatter.examples,
      prerequisites: target.frontmatter.prerequisites,
    },
    current,
    stampIso,
  );
}

/** Flips the per-Skill auto_evolve toggle (PA-SKILL-3) — does NOT bump the version. */
export async function setAutoEvolve(
  ctx: SkillRepo,
  slug: string,
  enabled: boolean,
): Promise<WriteResult> {
  const current = await readSkill(ctx, slug);
  if (!current) return { ok: false, error: "Skill not found." };
  const updated: Skill = {
    ...current,
    frontmatter: {
      ...current.frontmatter,
      evolution: { ...current.frontmatter.evolution, autoEvolve: enabled },
    },
  };
  const token = requireToken(ctx);
  if (!token) return { ok: false, error: "Connect your brain (GitHub) to manage Skills." };
  const live = await commitMemoryFile({
    repo: ctx.repo,
    token,
    path: skillPath(slug),
    mode: "replace",
    content: serializeSkill(updated),
    commitMessage: `skill: ${enabled ? "enable" : "disable"} auto-evolve ${slug}`,
  });
  if (!live.ok) return live;
  return { ok: true, sha: live.sha, version: updated.frontmatter.evolution.version };
}

/** Deletes a Skill's live SKILL.md (the owner owns the file and can remove it). The versions/
 *  history is left in place as a git record; listing keys off SKILL.md, so it stops appearing. */
export async function deleteSkill(ctx: SkillRepo, slug: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = requireToken(ctx);
  if (!token) return { ok: false, error: "Connect your brain (GitHub) to manage Skills." };
  const res = await deleteRepoFile({
    repo: ctx.repo,
    token,
    path: skillPath(slug),
    commitMessage: `skill: delete ${slug}`,
  });
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}

/** Records a triggered-run entry in the Skill's audit trail (PA-SKILL §7.2 step 4). Best-effort —
 *  a failed audit write never blocks a run; callers log the miss rather than swallow it. */
export async function appendTriggeredRecord(
  ctx: SkillRepo,
  slug: string,
  record: { runId: string; goal: string; outcome: SkillOutcome | "loaded"; stampIso: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = requireToken(ctx);
  if (!token) return { ok: false, error: "no token" };
  const content = [
    `# Triggered: ${slug}`,
    "",
    `- Run: ${record.runId}`,
    `- When: ${record.stampIso}`,
    `- Outcome: ${record.outcome}`,
    `- Goal: ${record.goal.replace(/\s+/g, " ").trim().slice(0, 400)}`,
  ].join("\n");
  const res = await commitMemoryFile({
    repo: ctx.repo,
    token,
    path: skillTriggeredPath(slug, record.stampIso, record.runId),
    mode: "replace",
    content,
    commitMessage: `skill: triggered ${slug} (${record.outcome})`,
  });
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}
