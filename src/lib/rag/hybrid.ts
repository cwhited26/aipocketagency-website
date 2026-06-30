// hybrid.ts — hybrid re-ranking for the turbovec retriever (PA-CTX-2).
//
// queryRag returns vector hits { docPath, score, snippet } from the Modal runtime. Pure vector recall
// misses exact-term matches (names, ids, rare jargon) that a user often searches by. This module adds
// a keyword-overlap component computed locally over each hit's snippet, normalizes both signals to
// [0,1] across the result set, and blends them 70/30 (vector/keyword). It re-ranks the SAME hits — it
// never changes the result contract — so every existing call site is untouched.
//
// Dependency-free + pure so the scorer is unit-testable in isolation.

import type { RagHit } from "./types";

export const VECTOR_WEIGHT = 0.7;
export const KEYWORD_WEIGHT = 0.3;

/** Lowercase alphanumeric tokens, length ≥ 2 (drops punctuation + single chars). */
export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => t.length >= 2);
}

/**
 * Jaccard overlap between the query terms and a document's terms: |A ∩ B| / |A ∪ B|, in [0,1].
 * Symmetric and bounded — a natural keyword-relevance signal that needs no corpus statistics (unlike
 * full BM25), which keeps it computable per-hit on the snippet alone.
 */
export function jaccardOverlap(queryTerms: readonly string[], docTerms: readonly string[]): number {
  const a = new Set(queryTerms);
  const b = new Set(docTerms);
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** Min-max normalize a list to [0,1]. A flat list (all equal) maps to all-1 so the signal is neutral. */
export function normalize(values: readonly number[]): number[] {
  if (values.length === 0) return [];
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (max === min) return values.map(() => 1);
  return values.map((v) => (v - min) / (max - min));
}

export type HybridHit = RagHit & {
  /** The blended score actually used for ranking (0.7·vector + 0.3·keyword, both normalized). */
  hybridScore: number;
  /** Normalized vector component, for observability. */
  vectorComponent: number;
  /** Normalized keyword component, for observability. */
  keywordComponent: number;
};

/**
 * Blend vector + keyword relevance and return hits sorted by the blended score (desc). The vector
 * component is the runtime's cosine score normalized across the set; the keyword component is the
 * Jaccard overlap of the query against each hit's snippet, normalized the same way. Ties keep the
 * incoming order (stable). An empty input returns an empty array.
 */
export function blendHybridScores(query: string, hits: readonly RagHit[]): HybridHit[] {
  if (hits.length === 0) return [];
  const queryTerms = tokenize(query);

  const vectorNorm = normalize(hits.map((h) => h.score));
  const keywordRaw = hits.map((h) => jaccardOverlap(queryTerms, tokenize(h.snippet)));
  const keywordNorm = normalize(keywordRaw);

  return hits
    .map((h, i) => {
      const vectorComponent = vectorNorm[i];
      const keywordComponent = keywordNorm[i];
      return {
        ...h,
        vectorComponent,
        keywordComponent,
        hybridScore: VECTOR_WEIGHT * vectorComponent + KEYWORD_WEIGHT * keywordComponent,
      };
    })
    .map((h, i) => ({ h, i }))
    .sort((x, y) => y.h.hybridScore - x.h.hybridScore || x.i - y.i)
    .map(({ h }) => h);
}
