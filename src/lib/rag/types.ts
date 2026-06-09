// types.ts — shared shapes + the vector-vs-grep threshold for the turbovec RAG layer (Personas
// SPEC §3.5, PA-RAG-1). The actual vector indexes are turbovec `.tq` / `.tvim` files on the Modal
// sub-agent runtime; this module is the dependency-free core the rest of lib/rag builds on, kept
// pure so the threshold + zone-containment logic is unit-testable in isolation.

import { createHash } from "node:crypto";

// SPEC §3.5: a zone uses turbovec once it exceeds ~100 source documents OR ~50,000 tokens of
// corpus, whichever is smaller. Below that, file-grep latency dominates index overhead — no reason
// to maintain a vector index for a dozen playbooks. These are the two thresholds, named so a tuning
// change is a one-line edit.
export const RAG_DOC_THRESHOLD = 100;
export const RAG_TOKEN_THRESHOLD = 50_000;

/** Default BYO embedding model (SPEC §3.5: fast / cheap; -large for high-recall corpora). */
export const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";

/**
 * True when a zone of this size should be served by the turbovec vector index rather than file-grep.
 * Either threshold crossing flips it on (the SPEC's "whichever is smaller"). A zone reports its size
 * from the pa_rag_indexes catalog (built corpus) or from a live file listing at call time.
 */
export function shouldUseVector(docCount: number, tokenCount: number): boolean {
  return docCount > RAG_DOC_THRESHOLD || tokenCount > RAG_TOKEN_THRESHOLD;
}

/** One retrieved document: the SPEC §3.5 query contract `{ docPath, score, snippet }`. */
export type RagHit = {
  docPath: string;
  score: number;
  snippet: string;
};

/** What queryRag returns: either vector hits, or a signal to use the caller's existing grep. */
export type RagQueryOutcome =
  | { source: "turbovec"; hits: RagHit[] }
  | { source: "fallback"; reason: string };

/**
 * Normalize a brain-repo-relative zone path to its canonical form: no leading/trailing slashes, no
 * `.` / `..` segments. Used for the zone-containment check and the Modal volume key so the same zone
 * always resolves to the same index regardless of how the caller spelled it.
 */
export function normalizeZonePath(zonePath: string): string {
  return zonePath
    .split("/")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s !== "." && s !== "..")
    .join("/");
}

/**
 * ContainmentGuard at the result layer (belt to the Modal index-level guard): a hit is only valid if
 * its docPath sits inside the queried zone. The Modal runtime already refuses to load an index
 * outside the zone, so this should never drop anything in practice — but it fails closed on the Node
 * side too, so a misconfigured index can never surface a cross-zone path to the LLM.
 */
export function isPathInZone(docPath: string, zonePath: string): boolean {
  const zone = normalizeZonePath(zonePath);
  const path = normalizeZonePath(docPath);
  if (!zone) return false;
  return path === zone || path.startsWith(`${zone}/`);
}

/** Drops any hit whose docPath escapes the queried zone (fail-closed). */
export function filterHitsToZone(hits: RagHit[], zonePath: string): RagHit[] {
  return hits.filter((h) => isPathInZone(h.docPath, zonePath));
}

/**
 * Deterministic short key for a (owner, zone) pair — used in cost-event idempotency keys and as the
 * Modal volume sub-path. Stable across processes (sha256 of the normalized zone), so a retry of the
 * same realized cost collapses to one ledger row.
 */
export function zoneKey(ownerId: string, zonePath: string): string {
  return createHash("sha256")
    .update(`${ownerId}:${normalizeZonePath(zonePath)}`)
    .digest("hex")
    .slice(0, 16);
}

/** Deterministic short hash of an arbitrary string (query idempotency keys). */
export function shortHash(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 16);
}
