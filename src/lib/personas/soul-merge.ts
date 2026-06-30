// soul-merge.ts — the supersession merge (SPEC §Extraction pipeline → "Supersession"). Pure,
// unit-tested. The DB write (pointing the victim's superseded_by at the new row) is orchestrated in
// soul-extract.ts; this file decides WHICH existing live attribute a new observation replaces.
//
// Rule: a new observation supersedes an existing LIVE attribute of the SAME kind when the two are
// "about the same dimension" — e.g. "prefers terse replies" supersedes "prefers long, detailed
// replies": same kind (response_preference), strong word overlap, opposite content. We don't try to
// detect contradiction semantically (a Haiku round-trip would be neither cheap nor deterministic);
// same-kind + high token overlap is the deterministic proxy. Two attributes about genuinely different
// things within a kind (two distinct boundaries) have low overlap and both survive.

import type { SoulAttributeKind, SoulAttributeRow } from "./soul-types";

// Words too common to carry meaning — excluded so overlap reflects the SUBJECT, not the scaffolding.
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "to", "of", "in", "on", "for", "with", "you", "your",
  "owner", "prefers", "prefer", "likes", "like", "wants", "want", "when", "they", "them", "is",
  "are", "be", "it", "this", "that", "their", "i", "me", "my", "do", "does", "not", "no",
]);

/** Lowercase content tokens (alpha, length ≥ 3, non-stopword) of a string. */
export function contentTokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.toLowerCase().split(/[^a-z]+/)) {
    if (raw.length >= 3 && !STOPWORDS.has(raw)) out.add(raw);
  }
  return out;
}

/** Jaccard overlap (|∩| / |∪|) of two token sets. 0 when both empty. */
export function tokenOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

// At/above this same-kind overlap the new observation is treated as the SAME dimension and supersedes.
// Deliberately low: contradicting preferences often share only one content noun ("prefers terse
// replies" vs "prefers long, detailed replies" share just "replies"), so a high bar would never catch
// the contradictions supersession exists for. Same-kind is itself a strong signal — within one kind a
// new observation usually refines/replaces rather than stacks; genuinely distinct items (two unrelated
// boundaries) share no content words and both survive.
export const SOUL_SUPERSEDE_OVERLAP = 0.2;

export type SoulMergeCandidate = {
  kind: SoulAttributeKind;
  summary: string;
  body?: string | null;
};

/**
 * Pick the existing live attribute a new observation supersedes, or null when it's net-new. Only
 * same-kind attributes are considered; among those, the one with the highest token overlap above the
 * threshold wins (ties broken by oldest-first, so the most established prior belief is the one
 * retired). `existing` should already be the persona's LIVE (not-superseded) attributes.
 */
export function findSupersededAttribute(
  existing: readonly SoulAttributeRow[],
  candidate: SoulMergeCandidate,
): SoulAttributeRow | null {
  const candTokens = contentTokens(`${candidate.summary} ${candidate.body ?? ""}`);
  let best: { row: SoulAttributeRow; overlap: number } | null = null;
  for (const row of existing) {
    if (row.attribute_kind !== candidate.kind) continue;
    const overlap = tokenOverlap(
      candTokens,
      contentTokens(`${row.attribute_summary} ${row.attribute_body ?? ""}`),
    );
    if (overlap < SOUL_SUPERSEDE_OVERLAP) continue;
    if (
      best === null ||
      overlap > best.overlap ||
      (overlap === best.overlap && row.created_at < best.row.created_at)
    ) {
      best = { row, overlap };
    }
  }
  return best?.row ?? null;
}

/** True when a candidate is an exact duplicate of a live attribute (same kind + same normalised
 *  summary) — used to suppress re-proposing or re-inserting something already held verbatim. */
export function isDuplicateOfLive(
  existing: readonly SoulAttributeRow[],
  candidate: SoulMergeCandidate,
): boolean {
  const norm = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, " ");
  const key = norm(candidate.summary);
  return existing.some(
    (r) => r.attribute_kind === candidate.kind && norm(r.attribute_summary) === key,
  );
}
