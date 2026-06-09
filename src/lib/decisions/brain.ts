// brain.ts — writes a saved verdict to brain/decisions/<YYYY-MM-DD>-<slug>.md and walks the
// supersede-chain (PA-DR-5 / PA-TEMP-*): when a new verdict lands on a question shape the brain already
// has a decision for, the prior file gets `superseded_by` set and the new one points back with
// `supersedes`. Also surfaces a matching prior verdict BEFORE a new debate fires (PA-DR §9 precedents),
// so yesterday's reasoning is shown rather than silently overwritten.

import { listRepoTree, fetchFileContent } from "@/lib/pa-brain";
import { commitBrainTextFile } from "@/lib/brain/absorb";
import type { DecisionType, StakesLevel, Verdict, RoundtableTurn } from "./types";
import { ROLE_LABELS } from "./types";

const DECISIONS_DIR = "brain/decisions";
const STOPWORDS = new Set([
  "the", "a", "an", "to", "of", "for", "on", "in", "is", "it", "do", "i", "we", "should", "my", "our",
  "and", "or", "with", "this", "that", "are", "be", "if", "at", "by", "up", "out", "can", "will",
]);

/** Significant lowercase tokens from a question, stopwords dropped — the unit of slug + precedent match. */
export function questionTokens(question: string): string[] {
  return question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

/** kebab slug for the filename, from the most significant tokens (capped so paths stay sane). */
export function slugForQuestion(question: string): string {
  const slug = questionTokens(question).slice(0, 8).join("-");
  return slug || "decision";
}

/** Jaccard overlap of two questions' significant token sets — drives precedent matching. */
export function questionOverlap(a: string, b: string): number {
  const sa = new Set(questionTokens(a));
  const sb = new Set(questionTokens(b));
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Markdown ─────────────────────────────────────────────────────────────────────────────────

export type VerdictWriteInput = {
  question: string;
  verdict: Verdict;
  // The owner-edited recommendation text (may differ from verdict.recommendation).
  savedRecommendation: string;
  decisionType: DecisionType;
  stakesLevel: StakesLevel;
  rolesUsed: string[];
  modelBackings: string[];
  turns: RoundtableTurn[];
};

export function buildVerdictMarkdown(input: VerdictWriteInput, supersedesFile: string | null): string {
  const slug = slugForQuestion(input.question);
  const desc = input.question.replace(/\s+/g, " ").trim().slice(0, 100);
  const transcript = input.turns
    .map((t) => `**${ROLE_LABELS[t.role]}${t.role === "owner_interjection" ? "" : ` · round ${t.round_index + 1}`}** (${t.model_backing})\n\n${t.content}`)
    .join("\n\n---\n\n");

  const frontmatter = [
    "---",
    `name: ${slug}`,
    `description: Decision Roundtable verdict — ${desc}`,
    "metadata:",
    "  type: decision",
    `decision_type: ${input.decisionType}`,
    `stakes_level: ${input.stakesLevel}`,
    `date: ${todayUtc()}`,
    `agents_used: [${input.rolesUsed.join(", ")}]`,
    `model_backings: [${input.modelBackings.join(", ")}]`,
    `supersedes: ${supersedesFile ?? ""}`,
    "superseded_by:",
    "---",
  ].join("\n");

  return [
    frontmatter,
    "",
    `## Question`,
    input.question.trim(),
    "",
    `## Verdict`,
    input.savedRecommendation.trim(),
    "",
    `## Strongest dissent`,
    input.verdict.strongestDissent.trim() || "_(none recorded)_",
    "",
    `## Supporting evidence`,
    input.verdict.supportingEvidence.trim() || "_(none cited)_",
    "",
    `## Transcript`,
    transcript || "_(no turns)_",
    "",
  ].join("\n");
}

/** Sets/updates the `superseded_by:` line in a decision file's frontmatter to point at the new file. */
export function setSupersededBy(priorContent: string, newFile: string): string {
  if (/^superseded_by:.*$/m.test(priorContent)) {
    return priorContent.replace(/^superseded_by:.*$/m, `superseded_by: ${newFile}`);
  }
  // No field yet — insert it just before the closing frontmatter fence.
  const fenceEnd = priorContent.indexOf("\n---", 3);
  if (fenceEnd === -1) return priorContent;
  return priorContent.slice(0, fenceEnd) + `\nsuperseded_by: ${newFile}` + priorContent.slice(fenceEnd);
}

// ── Precedent search ───────────────────────────────────────────────────────────────────────

export type Precedent = { path: string; date: string; verdict: string };

const PRECEDENT_THRESHOLD = 0.5;

function decisionFiles(tree: { path: string; type: string }[]): string[] {
  return tree
    .filter((e) => e.type === "blob" && /^brain\/decisions\/\d{4}-\d{2}-\d{2}-.*\.md$/.test(e.path))
    .map((e) => e.path);
}

/** Extracts the `## Verdict` body (first line) from a decision file for the precedent summary. */
function verdictSummaryOf(content: string): string {
  const m = content.match(/## Verdict\s*\n+([^\n]+)/);
  return (m?.[1] ?? "").trim().slice(0, 200);
}

function dateOf(path: string): string {
  return path.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? "";
}

/** Has the brain a non-superseded decision closely matching this question? Returns the best match
 *  above the overlap threshold, or null. Never throws — a brain-read failure just means no precedent. */
export async function findPrecedent(
  repo: string | null,
  token: string | null,
  question: string,
): Promise<Precedent | null> {
  if (!repo) return null;
  try {
    const tree = await listRepoTree(repo, token);
    const files = decisionFiles(tree);
    if (files.length === 0) return null;

    // Cheap first pass: rank candidates by filename-slug overlap so we only fetch the few best.
    const ranked = files
      .map((path) => ({ path, score: questionOverlap(question, path.replace(/^brain\/decisions\/\d{4}-\d{2}-\d{2}-/, "").replace(/\.md$/, "").replace(/-/g, " ")) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);

    let best: Precedent | null = null;
    let bestScore = PRECEDENT_THRESHOLD;
    for (const cand of ranked) {
      const content = await fetchFileContent(repo, cand.path, token);
      if (!content) continue;
      // Skip ones already superseded — the chain head is what we surface.
      if (/^superseded_by:\s*\S+/m.test(content)) continue;
      const descMatch = content.match(/^description:\s*Decision Roundtable verdict —\s*(.+)$/m);
      const priorQuestion = descMatch?.[1] ?? cand.path;
      const score = Math.max(cand.score, questionOverlap(question, priorQuestion));
      if (score >= bestScore) {
        bestScore = score;
        best = { path: cand.path, date: dateOf(cand.path), verdict: verdictSummaryOf(content) };
      }
    }
    return best;
  } catch {
    return null;
  }
}

// ── Write ──────────────────────────────────────────────────────────────────────────────────

export type WriteVerdictResult =
  | { ok: true; path: string; supersededFile: string | null }
  | { ok: false; error: string };

/**
 * Writes the saved verdict and walks the supersede-chain. Finds a non-superseded prior decision on the
 * same question shape; if one exists, stamps its `superseded_by` and points the new file's `supersedes`
 * back at it. Two commits (prior update, then new file) — commitBrainTextFile is single-file.
 */
export async function writeVerdictToBrain(
  repo: string,
  token: string,
  input: VerdictWriteInput,
): Promise<WriteVerdictResult> {
  const prior = await findPrecedent(repo, token, input.question);
  const supersedesFile = prior ? prior.path.replace(/^brain\/decisions\//, "") : null;

  // Update the prior file's chain pointer first (best-effort — a failure here must not block the save).
  if (prior) {
    const priorContent = await fetchFileContent(repo, prior.path, token);
    if (priorContent) {
      const newFileName = `${todayUtc()}-${slugForQuestion(input.question)}.md`;
      const updated = setSupersededBy(priorContent, newFileName);
      if (updated !== priorContent) {
        await commitBrainTextFile({
          repo,
          token,
          path: prior.path,
          content: updated,
          commitMessage: `decisions: supersede ${supersedesFile} with new roundtable verdict`,
        });
      }
    }
  }

  const fileName = `${todayUtc()}-${slugForQuestion(input.question)}.md`;
  const path = `${DECISIONS_DIR}/${fileName}`;
  const markdown = buildVerdictMarkdown(input, supersedesFile);
  const result = await commitBrainTextFile({
    repo,
    token,
    path,
    content: markdown,
    commitMessage: `decisions: save roundtable verdict — ${slugForQuestion(input.question)}`,
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, path, supersededFile: supersedesFile };
}
