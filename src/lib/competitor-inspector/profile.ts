// profile.ts — assemble the competitor profile markdown (SPEC §7.3): the Inspector's wrapper
// fields top-level, the identical design_dna: block embedded (same schema_version, same parser
// as a standalone design-dna/ record), prose body below for the owner. The schema carries no
// copy and no assets — structurally it can't (PA-DNA-7).

import { serializeDesignDna, serializeSourceMeta, yamlScalar } from "@/lib/url-extraction/serialize";
import type { DesignDna, SourceMeta } from "@/lib/url-extraction/types";
import { DNA_SCHEMA_VERSION } from "@/lib/url-extraction/types";
import type { ProfileProse } from "./types";

/** Deterministic tags for the profile: mode, interaction model, the strongest archetypes. */
export function profileTags(dna: DesignDna): string[] {
  const tags: string[] = [dna.palette.mode, dna.interaction_model];
  const archetypes = dna.layout
    .map((l) => l.archetype)
    .filter((a) => a !== "content-stack" && a !== "media-block" && a !== "static-nav" && a !== "stacked-footer");
  for (const archetype of archetypes) {
    if (!tags.includes(archetype)) tags.push(archetype);
    if (tags.length >= 6) break;
  }
  return tags;
}

export function buildCompetitorProfileMd(params: {
  sourceSlug: string;
  dna: DesignDna;
  source: SourceMeta;
  ownerNote: string | null;
  prose: ProfileProse;
}): string {
  const { dna, source, prose } = params;
  const domain = (() => {
    try {
      return new URL(source.final_url).hostname.replace(/^www\./, "");
    } catch {
      return params.sourceSlug;
    }
  })();
  const capturedHuman = new Date(`${source.captured_at}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  const frontmatter = [
    "---",
    "record: competitor-profile",
    `schema_version: ${DNA_SCHEMA_VERSION}`,
    `slug: ${yamlScalar(params.sourceSlug)}`,
    serializeSourceMeta(source),
    ...(params.ownerNote ? [`owner_note: ${yamlScalar(params.ownerNote)}`] : []),
    `offer_summary: ${yamlScalar(prose.offer_summary)}`,
    "watch_state: one_off",
    `tags: [${profileTags(dna).map((t) => yamlScalar(t)).join(", ")}]`,
    serializeDesignDna(dna),
    "---",
  ].join("\n");

  const coverageLines = [
    `Unattended headless capture of ${source.final_url}.`,
    dna.coverage.bot_wall ? "An anti-bot wall degraded this capture — treat the values as partial." : null,
    dna.coverage.missed.length > 0
      ? `Not covered: ${dna.coverage.missed.join("; ")}.`
      : "Nothing flagged as missed, but completeness is never assumed on an unattended run.",
    "The full step-by-step run record is in extraction-log.md beside this file.",
  ].filter((l): l is string => l !== null);

  const body = [
    `# ${domain} — captured ${capturedHuman}`,
    "",
    "## What they appear to sell",
    prose.offer_summary,
    "",
    "## The look in one paragraph",
    prose.look_paragraph,
    "",
    "## What's distinctive",
    ...prose.distinctive.map((d) => `- ${d}`),
    "",
    "## What to borrow / what to skip",
    prose.borrow_skip,
    "",
    "## Coverage notes",
    ...coverageLines,
    "",
  ].join("\n");

  return `${frontmatter}\n\n${body}`;
}
