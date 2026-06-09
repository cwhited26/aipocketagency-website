// client.ts — thin HTTP client to the turbovec RAG endpoints on the Modal sub-agent runtime
// (cwhited26/pa-orchestrator-runtime). Two endpoints: POST /rag/build (embed a zone's docs + write
// the .tq / .tvim index to the per-owner Modal volume) and POST /rag/query (embed the query, search
// the zone index, return { docPath, score, snippet }[]). Direct REST, Modal proxy-auth headers — no
// SDK (repo rule).
//
// Graceful degradation: when PA_RAG_RUNTIME_URL / Modal tokens aren't set, every call returns
// { ok: false, degraded: "not_configured" } so the caller falls back to file-grep. Prod stays safe
// until Chase deploys the runtime and sets the env — nothing half-fires.

import type { RagHit } from "./types";

export type RagRuntimeConfig = {
  url: string;
  tokenId: string;
  tokenSecret: string;
};

/** Reads the Modal RAG runtime config from env, or null when any required value is missing. */
export function ragRuntimeConfig(): RagRuntimeConfig | null {
  const url = process.env.PA_RAG_RUNTIME_URL;
  const tokenId = process.env.MODAL_TOKEN_ID;
  const tokenSecret = process.env.MODAL_TOKEN_SECRET;
  if (!url || !tokenId || !tokenSecret) return null;
  return { url: url.replace(/\/$/, ""), tokenId, tokenSecret };
}

export function isRagRuntimeConfigured(): boolean {
  return ragRuntimeConfig() !== null;
}

function modalHeaders(cfg: RagRuntimeConfig): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "Modal-Key": cfg.tokenId,
    "Modal-Secret": cfg.tokenSecret,
  };
}

export type RagBuildDoc = { docPath: string; text: string };

export type RagBuildResult =
  | {
      ok: true;
      docCount: number;
      tokenCount: number;
      embeddingTokens: number;
      dim: number;
      cpuSeconds: number;
    }
  | { ok: false; degraded: "not_configured" }
  | { ok: false; degraded: "error"; error: string };

/**
 * Dispatch a build: the runtime embeds every doc (BYO model), builds the turbovec index, and writes
 * `.tq` + `.tvim` to the owner's Modal volume keyed by zone. Returns the realized embedding-token +
 * CPU-second usage so the Node tier can write the cost-ledger rows.
 */
export async function ragBuildRemote(input: {
  ownerId: string;
  zonePath: string;
  embeddingModel: string;
  docs: RagBuildDoc[];
}): Promise<RagBuildResult> {
  const cfg = ragRuntimeConfig();
  if (!cfg) return { ok: false, degraded: "not_configured" };

  try {
    const res = await fetch(`${cfg.url}/rag/build`, {
      method: "POST",
      headers: modalHeaders(cfg),
      body: JSON.stringify({
        ownerId: input.ownerId,
        zonePath: input.zonePath,
        embeddingModel: input.embeddingModel,
        docs: input.docs,
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, degraded: "error", error: `Runtime ${res.status}: ${text.slice(0, 200)}` };
    }
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      docCount?: number;
      tokenCount?: number;
      embeddingTokens?: number;
      dim?: number;
      cpuSeconds?: number;
      error?: string;
    };
    if (!data.ok) {
      return { ok: false, degraded: "error", error: data.error ?? "Build rejected by runtime" };
    }
    return {
      ok: true,
      docCount: data.docCount ?? input.docs.length,
      tokenCount: data.tokenCount ?? 0,
      embeddingTokens: data.embeddingTokens ?? 0,
      dim: data.dim ?? 0,
      cpuSeconds: data.cpuSeconds ?? 0,
    };
  } catch (e) {
    return { ok: false, degraded: "error", error: e instanceof Error ? e.message : "Build dispatch failed" };
  }
}

export type RagQueryResult =
  | { ok: true; hits: RagHit[]; embeddingTokens: number; cpuSeconds: number }
  | { ok: false; degraded: "not_configured" }
  | { ok: false; degraded: "not_built" }
  | { ok: false; degraded: "out_of_zone"; error: string }
  | { ok: false; degraded: "error"; error: string };

/**
 * Dispatch a query: the runtime embeds `query`, searches the zone's index, and returns the top-N
 * `{ docPath, score, snippet }`. The runtime enforces ContainmentGuard at the index level — a query
 * whose zone doesn't match the loaded index is rejected with HTTP 403 + `{ code: "out_of_zone" }`,
 * surfaced here as `degraded: "out_of_zone"`. A never-built zone returns `degraded: "not_built"` so
 * the caller falls back to grep + (optionally) kicks a build.
 */
export async function ragQueryRemote(input: {
  ownerId: string;
  zonePath: string;
  embeddingModel: string;
  query: string;
  topN: number;
}): Promise<RagQueryResult> {
  const cfg = ragRuntimeConfig();
  if (!cfg) return { ok: false, degraded: "not_configured" };

  try {
    const res = await fetch(`${cfg.url}/rag/query`, {
      method: "POST",
      headers: modalHeaders(cfg),
      body: JSON.stringify({
        ownerId: input.ownerId,
        zonePath: input.zonePath,
        embeddingModel: input.embeddingModel,
        query: input.query,
        topN: input.topN,
      }),
      cache: "no-store",
    });

    if (res.status === 403) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, degraded: "out_of_zone", error: body.error ?? "Query outside the index's zone" };
    }
    if (res.status === 404) {
      return { ok: false, degraded: "not_built" };
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, degraded: "error", error: `Runtime ${res.status}: ${text.slice(0, 200)}` };
    }

    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      code?: string;
      results?: { docPath?: string; score?: number; snippet?: string }[];
      embeddingTokens?: number;
      cpuSeconds?: number;
      error?: string;
    };
    if (data.code === "not_built") return { ok: false, degraded: "not_built" };
    if (data.code === "out_of_zone") {
      return { ok: false, degraded: "out_of_zone", error: data.error ?? "Query outside the index's zone" };
    }
    if (!data.ok) return { ok: false, degraded: "error", error: data.error ?? "Query rejected by runtime" };

    const hits: RagHit[] = (data.results ?? []).map((r) => ({
      docPath: typeof r.docPath === "string" ? r.docPath : "",
      score: typeof r.score === "number" ? r.score : 0,
      snippet: typeof r.snippet === "string" ? r.snippet : "",
    }));
    return {
      ok: true,
      hits,
      embeddingTokens: data.embeddingTokens ?? 0,
      cpuSeconds: data.cpuSeconds ?? 0,
    };
  } catch (e) {
    return { ok: false, degraded: "error", error: e instanceof Error ? e.message : "Query dispatch failed" };
  }
}
