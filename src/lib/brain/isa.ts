// isa.ts — the ISA (Ideal State Artifact) primitive. Customer-facing UI calls these
// "Specs"; we never surface "ISA" in user copy. A spec is a 12-section markdown PRD
// written to `<scope>/SPEC.md` in the brain repo via the existing brain-write infra.
//
// The Success Criteria section doubles as a verification checklist the agent can
// self-check against later.

import { z } from "zod";
import { commitMemoryFile, fetchFileContent, listRepoTree } from "@/lib/pa-brain";
import {
  buildSectionedMarkdown,
  parseSectionedMarkdown,
  type SectionDef,
} from "./sections";

export const SPEC_FILENAME = "SPEC.md";

// The 12 canonical sections, in the order they appear in the file and the wizard.
export const SPEC_SECTIONS: SectionDef[] = [
  { key: "problem", heading: "Problem" },
  { key: "vision", heading: "Vision" },
  { key: "outOfScope", heading: "Out of Scope" },
  { key: "principles", heading: "Principles" },
  { key: "constraints", heading: "Constraints" },
  { key: "goal", heading: "Goal" },
  { key: "successCriteria", heading: "Success Criteria" },
  { key: "testStrategy", heading: "Test Strategy" },
  { key: "features", heading: "Features" },
  { key: "decisions", heading: "Decisions" },
  { key: "changelog", heading: "Changelog" },
  { key: "verification", heading: "Verification" },
];

export const SPEC_SECTION_HELP: Record<string, string> = {
  problem: "What problem is this solving? Who feels it and why does it matter now?",
  vision: "What does the ideal end state look like once this is done?",
  outOfScope: "What are you deliberately NOT doing here? Draw the boundaries.",
  principles: "The non-negotiable values or rules that guide every decision here.",
  constraints: "Hard limits — budget, time, tech, legal, people.",
  goal: "The single, concrete objective this spec is driving toward.",
  successCriteria: "How you'll know it's done. Each line is a checkable item.",
  testStrategy: "How the result gets verified — tests, reviews, acceptance checks.",
  features: "The concrete capabilities or deliverables that make up the work.",
  decisions: "Key decisions made and the reasoning behind them.",
  changelog: "A running log of notable changes to this spec over time.",
  verification: "Final sign-off notes — what was checked and confirmed at the end.",
};

export type SpecFields = Record<string, string>;

// ── Schema ──────────────────────────────────────────────────────────────────────

// Each section is free text; Problem/Vision/Goal are required so a spec is never an
// empty shell. A scope is a brain-repo-relative directory ("" = repo root).
const specSectionShape = Object.fromEntries(
  SPEC_SECTIONS.map((s) => [
    s.key,
    s.key === "problem" || s.key === "vision" || s.key === "goal"
      ? z.string().trim().min(1, `${s.heading} is required`).max(20_000)
      : z.string().max(20_000).optional().default(""),
  ]),
);

export const SpecInputSchema = z.object({
  // A repo-relative directory. Empty string means the repo root (-> SPEC.md).
  // Disallow leading slash, "..", and a trailing SPEC.md so we always control the file name.
  scope: z
    .string()
    .max(200)
    .regex(/^(?!\/)(?!.*\.\.)(?!.*SPEC\.md$)[A-Za-z0-9._\-/]*$/, "Invalid scope path")
    .default(""),
  fields: z.object(specSectionShape),
});

export type SpecInput = z.infer<typeof SpecInputSchema>;

// ── Path helpers ────────────────────────────────────────────────────────────────

export function specPathForScope(scope: string): string {
  const clean = scope.replace(/^\/+|\/+$/g, "").trim();
  return clean ? `${clean}/${SPEC_FILENAME}` : SPEC_FILENAME;
}

export function scopeForSpecPath(path: string): string {
  return path.replace(new RegExp(`/?${SPEC_FILENAME}$`), "");
}

// ── Serialize / parse ───────────────────────────────────────────────────────────

export function buildSpecMarkdown(fields: SpecFields): string {
  return buildSectionedMarkdown("Spec", SPEC_SECTIONS, fields);
}

export function parseSpecMarkdown(md: string): SpecFields {
  return parseSectionedMarkdown(md, SPEC_SECTIONS);
}

// ── Repo operations ─────────────────────────────────────────────────────────────

export type SpecListItem = {
  path: string;
  scope: string;
  // "Root" for a repo-root spec, otherwise the scope directory.
  scopeLabel: string;
};

/**
 * Lists every SPEC.md in the brain repo (any depth) via one recursive tree call.
 */
export async function listSpecs(
  repo: string,
  token: string | null,
): Promise<SpecListItem[]> {
  const tree = await listRepoTree(repo, token);
  return tree
    .filter((e) => e.type === "blob" && (e.path === SPEC_FILENAME || e.path.endsWith(`/${SPEC_FILENAME}`)))
    .map((e) => {
      const scope = scopeForSpecPath(e.path);
      return { path: e.path, scope, scopeLabel: scope || "Root" };
    })
    .sort((a, b) => a.scopeLabel.localeCompare(b.scopeLabel));
}

export async function fetchSpec(
  repo: string,
  token: string | null,
  scope: string,
): Promise<SpecFields | null> {
  const raw = await fetchFileContent(repo, specPathForScope(scope), token);
  if (!raw) return null;
  return parseSpecMarkdown(raw);
}

export async function saveSpec(params: {
  repo: string;
  token: string;
  scope: string;
  fields: SpecFields;
}): Promise<{ ok: true; sha: string; path: string } | { ok: false; error: string }> {
  const path = specPathForScope(params.scope);
  const result = await commitMemoryFile({
    repo: params.repo,
    token: params.token,
    path,
    mode: "replace",
    content: buildSpecMarkdown(params.fields),
    commitMessage: `brain: update spec ${path}`,
  });
  if (!result.ok) return result;
  return { ok: true, sha: result.sha, path };
}
