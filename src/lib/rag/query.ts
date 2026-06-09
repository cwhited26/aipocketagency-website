// query.ts — the public RAG surface (PA-RAG-2). Two entry points the rest of the app calls:
//
//   queryRag(...)           — above the ~100-doc / ~50k-token threshold, embed + vector-search the
//                             zone on the Modal runtime and return { docPath, score, snippet }[];
//                             below it (or when the index isn't ready / runtime isn't configured),
//                             return a `fallback` signal so the caller uses its existing file-grep.
//   buildOrRefreshIndex(...) — dispatch a Modal build for a zone and stamp pa_rag_indexes. Idempotent
//                             on concurrent dispatch (the build claim is an atomic compare-and-set).
//
// ContainmentGuard is enforced two ways: the Modal runtime refuses to load an index outside the
// queried zone (structural, index-level) and surfaces an out-of-zone query as HTTP 403; this module
// turns that into a thrown RagContainmentError so a misconfigured query fails CLOSED — it never
// silently degrades to a cross-zone grep — and the result hits are filtered to the zone as a belt.

import {
  DEFAULT_EMBEDDING_MODEL,
  filterHitsToZone,
  normalizeZonePath,
  shortHash,
  shouldUseVector,
  zoneKey,
  type RagHit,
  type RagQueryOutcome,
} from "./types";
import {
  getRagIndex,
  claimBuild,
  markReady,
  markError,
  type RagChangeCursor,
  type RagZoneType,
} from "./db";
import {
  isRagRuntimeConfigured,
  ragBuildRemote,
  ragQueryRemote,
  type RagBuildDoc,
} from "./client";
import { logRagEmbedCost, logRagModalCost } from "./cost";

/**
 * A query targeted a zone that doesn't match the loaded index — a structural containment violation.
 * Thrown (not swallowed) so it fails closed: a cross-zone query never silently degrades to grep.
 */
export class RagContainmentError extends Error {
  readonly zonePath: string;
  constructor(zonePath: string, detail: string) {
    super(`RagContainmentBlocked: query is outside the index's zone "${zonePath}" — ${detail}`);
    this.name = "RagContainmentError";
    this.zonePath = zonePath;
  }
}

const DEFAULT_TOP_N = 8;

export type QueryRagInput = {
  ownerId: string;
  zonePath: string;
  query: string;
  topN?: number;
  /**
   * Live corpus size, when the caller already knows it (e.g. a persona that just listed its zone).
   * When omitted, the pa_rag_indexes catalog supplies the size from the last build.
   */
  docCount?: number;
  tokenCount?: number;
};

/**
 * Retrieve the most relevant docs for `query` within `zonePath`. Returns vector hits above the
 * threshold (and when the index is ready + the runtime is configured); otherwise returns a
 * `fallback` outcome telling the caller to run its existing grep. Throws RagContainmentError if the
 * runtime rejects the query as out-of-zone.
 */
export async function queryRag(input: QueryRagInput): Promise<RagQueryOutcome> {
  const zonePath = normalizeZonePath(input.zonePath);
  const topN = input.topN ?? DEFAULT_TOP_N;
  const query = input.query.trim();

  if (!zonePath) return { source: "fallback", reason: "empty_zone" };
  if (!query) return { source: "fallback", reason: "empty_query" };
  if (!isRagRuntimeConfigured()) return { source: "fallback", reason: "runtime_not_configured" };

  // Decide vector-vs-grep. Prefer the caller's live size; else read the catalog.
  const row = await getRagIndex(input.ownerId, zonePath);
  const docCount = input.docCount ?? row?.doc_count ?? 0;
  const tokenCount = input.tokenCount ?? row?.token_count ?? 0;
  if (!shouldUseVector(docCount, tokenCount)) {
    return { source: "fallback", reason: "below_threshold" };
  }
  if (!row || row.status !== "ready") {
    return { source: "fallback", reason: "index_not_ready" };
  }

  const result = await ragQueryRemote({
    ownerId: input.ownerId,
    zonePath,
    embeddingModel: row.embedding_model || DEFAULT_EMBEDDING_MODEL,
    query,
    topN,
  });

  if (!result.ok) {
    if (result.degraded === "out_of_zone") {
      throw new RagContainmentError(zonePath, result.error);
    }
    // not_built / not_configured / error → fall back to grep.
    return { source: "fallback", reason: result.degraded };
  }

  // Cost ledger: one row for the query embed, one for the Modal compute. Deterministic keys. When the
  // runtime served the query off its exact-cosine fallback (turbovec unavailable), stamp the Modal
  // cost row's metadata so Mission Control surfaces that the slow correct path ran.
  const key = `rag:query:${zoneKey(input.ownerId, zonePath)}:${shortHash(`${query}:${topN}`)}`;
  await Promise.all([
    logRagEmbedCost({
      ownerId: input.ownerId,
      embeddingModel: row.embedding_model || DEFAULT_EMBEDDING_MODEL,
      tokens: result.embeddingTokens,
      idempotencyKey: `${key}:embed`,
    }),
    logRagModalCost({
      ownerId: input.ownerId,
      cpuSeconds: result.cpuSeconds,
      idempotencyKey: `${key}:modal`,
      metadata: result.fallback ? { rag_fallback: "exact_cosine" } : undefined,
    }),
  ]);

  // Belt: drop any hit whose path escaped the zone (the runtime should never return one).
  return { source: "turbovec", hits: filterHitsToZone(result.hits, zonePath) };
}

export type BuildOutcome =
  | { status: "built"; docCount: number; tokenCount: number }
  | { status: "skipped"; reason: string }
  | { status: "error"; reason: string };

/**
 * Build (or rebuild) the turbovec index for a zone. The caller lists + reads the zone's files
 * (ContainmentGuard-checked) and passes them as `docs`; this dispatches the Modal build, stamps
 * pa_rag_indexes.last_built_at, and writes the cost-ledger rows.
 *
 * Idempotent on concurrent dispatch: claimBuild is an atomic compare-and-set (status → building only
 * when not already building). A dispatch that loses the race returns { status: "skipped",
 * reason: "in_progress" } without firing a second Modal build.
 */
export async function buildOrRefreshIndex(input: {
  ownerId: string;
  zonePath: string;
  embeddingModel?: string;
  docs: RagBuildDoc[];
  /** Whether the zone is brain-repo-backed ('file') or database-backed ('project'). Defaults 'file'. */
  zoneType?: RagZoneType;
  /** The zone's change-detection state at build time — stamped on the catalog row for idle-skip. */
  changeCursor?: RagChangeCursor;
}): Promise<BuildOutcome> {
  const zonePath = normalizeZonePath(input.zonePath);
  const embeddingModel = input.embeddingModel || DEFAULT_EMBEDDING_MODEL;
  if (!zonePath) return { status: "skipped", reason: "empty_zone" };
  if (!isRagRuntimeConfigured()) return { status: "skipped", reason: "runtime_not_configured" };
  if (input.docs.length === 0) return { status: "skipped", reason: "empty_zone" };

  const claim = await claimBuild(input.ownerId, zonePath, embeddingModel, input.zoneType ?? "file");
  if (!claim.claimed) return { status: "skipped", reason: "in_progress" };

  // One deterministic build id for this dispatch (reused if the cost-log call itself retries).
  const buildId = `rag:build:${zoneKey(input.ownerId, zonePath)}:${new Date().toISOString()}`;

  const built = await ragBuildRemote({
    ownerId: input.ownerId,
    zonePath,
    embeddingModel,
    docs: input.docs,
  });

  if (!built.ok) {
    const reason = built.degraded === "error" ? built.error : built.degraded;
    await markError(input.ownerId, zonePath, reason);
    return { status: "error", reason };
  }

  await markReady(input.ownerId, zonePath, {
    docCount: built.docCount,
    tokenCount: built.tokenCount,
    embeddingModel,
    changeCursor: input.changeCursor,
  });

  await Promise.all([
    logRagEmbedCost({
      ownerId: input.ownerId,
      embeddingModel,
      tokens: built.embeddingTokens,
      idempotencyKey: `${buildId}:embed`,
    }),
    logRagModalCost({
      ownerId: input.ownerId,
      cpuSeconds: built.cpuSeconds,
      idempotencyKey: `${buildId}:modal`,
    }),
  ]);

  return { status: "built", docCount: built.docCount, tokenCount: built.tokenCount };
}

export { shouldUseVector, RAG_DOC_THRESHOLD, RAG_TOKEN_THRESHOLD, DEFAULT_EMBEDDING_MODEL } from "./types";
export type { RagHit, RagQueryOutcome } from "./types";
