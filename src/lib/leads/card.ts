// card.ts — shared presentation helpers for the Lead Scout batch cards.
//
// Both sub-pipelines (url-list scout + google-maps-sweep) stage a `lead_scout_batch` Mission Control
// card with the same classification vocabulary and the same "top leads" preview, so the labels, the
// warmest-first ordering, and the slug helper live here once rather than in each orchestrator.

import type { LeadClassification } from "./types";

export const CLASSIFICATION_LABEL: Record<LeadClassification, string> = {
  hot: "Hot",
  warm: "Warm",
  cold: "Cold",
  wrong_fit: "Wrong fit",
  needs_research: "Needs research",
};

// Sort order for the "top leads" preview — warmest first.
export const CLASSIFICATION_RANK: Record<LeadClassification, number> = {
  hot: 0,
  warm: 1,
  needs_research: 2,
  cold: 3,
  wrong_fit: 4,
};

/** URL-safe slug for brain paths + card ids; falls back to "source" when nothing survives. */
export function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "source"
  );
}

/** One extracted lead, reduced to what the card preview needs. */
export type TopLead = {
  name: string;
  domain: string;
  summary: string;
  url: string;
  classification: LeadClassification;
};

/** The "**Top leads**" markdown block — warmest first, capped at `limit`. */
export function topLeadsBlock(leads: TopLead[], limit = 5): string {
  const top = [...leads]
    .sort((a, b) => CLASSIFICATION_RANK[a.classification] - CLASSIFICATION_RANK[b.classification])
    .slice(0, limit);
  const lines = top.length
    ? top
        .map(
          (o) =>
            `- **${o.name || o.domain}** (${CLASSIFICATION_LABEL[o.classification]}) — ${o.summary || o.url}`,
        )
        .join("\n")
    : "_No profiles extracted this run._";
  return ["**Top leads**", "", lines].join("\n");
}
