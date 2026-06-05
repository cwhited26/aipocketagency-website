// telos.ts — the TELOS primitive. Customer-facing UI calls this the "North Star";
// we never surface "TELOS" in user copy. It's a single markdown artifact at the brain
// repo root (TELOS.md) capturing the business's mission, goals, beliefs, wisdom,
// challenges, and mental models. PA prioritizes work against this instead of generic
// optimization.

import { z } from "zod";
import { commitMemoryFile, fetchFileContent } from "@/lib/pa-brain";
import {
  buildSectionedMarkdown,
  parseSectionedMarkdown,
  type SectionDef,
} from "./sections";

export const TELOS_PATH = "TELOS.md";

export const TELOS_SECTIONS: SectionDef[] = [
  { key: "mission", heading: "Mission" },
  { key: "goals", heading: "Goals" },
  { key: "beliefs", heading: "Beliefs" },
  { key: "wisdom", heading: "Wisdom" },
  { key: "challenges", heading: "Challenges" },
  { key: "mentalModels", heading: "Mental Models" },
];

export const TELOS_SECTION_HELP: Record<string, string> = {
  mission: "The one sentence that says why this business exists.",
  goals: "What you're driving toward — concrete outcomes over the next 1–3 years.",
  beliefs: "Core convictions about your market, customers, and how you operate.",
  wisdom: "Hard-won lessons you want every decision to honor.",
  challenges: "The real obstacles and tensions standing in the way right now.",
  mentalModels: "The frameworks and rules of thumb you think with.",
};

export type TelosFields = Record<string, string>;

const telosSectionShape = Object.fromEntries(
  TELOS_SECTIONS.map((s) => [
    s.key,
    s.key === "mission"
      ? z.string().trim().min(1, "Mission is required").max(20_000)
      : z.string().max(20_000).optional().default(""),
  ]),
);

export const TelosInputSchema = z.object({
  fields: z.object(telosSectionShape),
});

export type TelosInput = z.infer<typeof TelosInputSchema>;

export function buildTelosMarkdown(fields: TelosFields): string {
  return buildSectionedMarkdown("North Star", TELOS_SECTIONS, fields);
}

export function parseTelosMarkdown(md: string): TelosFields {
  return parseSectionedMarkdown(md, TELOS_SECTIONS);
}

export async function fetchTelos(
  repo: string,
  token: string | null,
): Promise<TelosFields | null> {
  const raw = await fetchFileContent(repo, TELOS_PATH, token);
  if (!raw) return null;
  return parseTelosMarkdown(raw);
}

export async function saveTelos(params: {
  repo: string;
  token: string;
  fields: TelosFields;
}): Promise<{ ok: true; sha: string } | { ok: false; error: string }> {
  return commitMemoryFile({
    repo: params.repo,
    token: params.token,
    path: TELOS_PATH,
    mode: "replace",
    content: buildTelosMarkdown(params.fields),
    commitMessage: "brain: update North Star (TELOS.md)",
  });
}
