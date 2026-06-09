// query.test.ts — unit + integration coverage for the turbovec RAG layer (Personas SPEC §3.5).
//
// Covers the three behaviors the SPEC + the build brief call out:
//   1. Threshold fallback — below ~100 docs / ~50k tokens queryRag returns a `fallback` signal and
//      never touches Modal; above it (with a ready index) it vector-searches.
//   2. ContainmentGuard rejection — an out-of-zone query the runtime refuses (403) surfaces as a
//      thrown RagContainmentError, never a silent cross-zone grep; out-of-zone hits are filtered.
//   3. Build idempotency — a concurrent dispatch that loses the claim is skipped, not double-built.
// Plus an integration over a synthetic 150-doc zone end-to-end through a mocked Modal + Supabase.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  shouldUseVector,
  filterHitsToZone,
  RAG_DOC_THRESHOLD,
  RAG_TOKEN_THRESHOLD,
} from "../types";
import { queryRag, buildOrRefreshIndex, RagContainmentError } from "../query";

// ── Mocked transport ─────────────────────────────────────────────────────────────────────────
// Every network call (Supabase REST + Modal RAG + the cost ledger) routes through one stubbed
// fetch; each test installs a handler that answers by URL + method. Calls are recorded so a test can
// assert that Modal was (or was NOT) reached.

type Handler = (url: string, init: RequestInit | undefined) => { status: number; body: unknown };
let calls: { url: string; method: string }[] = [];

function install(handler: Handler): void {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      calls.push({ url, method: (init?.method ?? "GET").toUpperCase() });
      const { status, body } = handler(url, init);
      return new Response(body === null ? null : JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      });
    }),
  );
}

function setRuntimeEnv(): void {
  vi.stubEnv("PA_RAG_RUNTIME_URL", "https://rag.modal.test");
  vi.stubEnv("MODAL_TOKEN_ID", "tok");
  vi.stubEnv("MODAL_TOKEN_SECRET", "sec");
  vi.stubEnv("POCKET_AGENT_SUPABASE_URL", "https://sb.test");
  vi.stubEnv("POCKET_AGENT_SUPABASE_SERVICE_KEY", "service-key");
}

const OWNER = "11111111-1111-1111-1111-111111111111";

function catalogRow(over: Partial<Record<string, unknown>> = {}): unknown {
  return {
    id: "idx-1",
    owner_id: OWNER,
    zone_path: "memory",
    embedding_model: "text-embedding-3-small",
    doc_count: 150,
    token_count: 80_000,
    status: "ready",
    last_built_at: "2026-06-01T00:00:00Z",
    last_error: null,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    ...over,
  };
}

function modalCalled(path: string): boolean {
  return calls.some((c) => c.url.includes(path));
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

// ── 1. Threshold ──────────────────────────────────────────────────────────────────────────────

describe("shouldUseVector threshold", () => {
  it("is false below both thresholds", () => {
    expect(shouldUseVector(10, 1_000)).toBe(false);
    expect(shouldUseVector(RAG_DOC_THRESHOLD, RAG_TOKEN_THRESHOLD)).toBe(false); // strictly greater
  });
  it("is true once docs exceed the doc threshold", () => {
    expect(shouldUseVector(RAG_DOC_THRESHOLD + 1, 0)).toBe(true);
  });
  it("is true once tokens exceed the token threshold", () => {
    expect(shouldUseVector(1, RAG_TOKEN_THRESHOLD + 1)).toBe(true);
  });
});

describe("queryRag fallback below threshold", () => {
  beforeEach(setRuntimeEnv);

  it("returns fallback and never calls Modal for a small zone", async () => {
    install((url) => {
      if (url.includes("/rest/v1/pa_rag_indexes")) {
        return { status: 200, body: [catalogRow({ doc_count: 12, token_count: 4_000 })] };
      }
      return { status: 200, body: {} };
    });

    const out = await queryRag({ ownerId: OWNER, zonePath: "memory", query: "what is our refund policy" });
    expect(out.source).toBe("fallback");
    if (out.source === "fallback") expect(out.reason).toBe("below_threshold");
    expect(modalCalled("/rag/query")).toBe(false);
  });

  it("returns fallback when the runtime is not configured (no fetch at all)", async () => {
    vi.unstubAllEnvs(); // drop PA_RAG_RUNTIME_URL
    install(() => ({ status: 200, body: {} }));
    const out = await queryRag({ ownerId: OWNER, zonePath: "memory", query: "hi", docCount: 999 });
    expect(out.source).toBe("fallback");
    if (out.source === "fallback") expect(out.reason).toBe("runtime_not_configured");
    expect(calls.length).toBe(0);
  });

  it("returns fallback when the index exists but is not ready", async () => {
    install((url) => {
      if (url.includes("/rest/v1/pa_rag_indexes")) {
        return { status: 200, body: [catalogRow({ status: "building" })] };
      }
      return { status: 200, body: {} };
    });
    const out = await queryRag({ ownerId: OWNER, zonePath: "memory", query: "x" });
    expect(out.source).toBe("fallback");
    if (out.source === "fallback") expect(out.reason).toBe("index_not_ready");
    expect(modalCalled("/rag/query")).toBe(false);
  });
});

// ── 2. ContainmentGuard ─────────────────────────────────────────────────────────────────────

describe("ContainmentGuard", () => {
  beforeEach(setRuntimeEnv);

  it("filterHitsToZone drops a hit whose path escapes the zone", () => {
    const hits = [
      { docPath: "memory/work/a.md", score: 0.9, snippet: "" },
      { docPath: "finance/secret.md", score: 0.8, snippet: "" },
    ];
    const kept = filterHitsToZone(hits, "memory");
    expect(kept).toHaveLength(1);
    expect(kept[0].docPath).toBe("memory/work/a.md");
  });

  it("throws RagContainmentError when the runtime rejects the query as out-of-zone", async () => {
    install((url) => {
      if (url.includes("/rest/v1/pa_rag_indexes")) return { status: 200, body: [catalogRow()] };
      if (url.includes("/rag/query")) {
        return { status: 403, body: { ok: false, code: "out_of_zone", error: "zone mismatch" } };
      }
      return { status: 200, body: {} };
    });

    await expect(
      queryRag({ ownerId: OWNER, zonePath: "memory", query: "leak owner-private data" }),
    ).rejects.toBeInstanceOf(RagContainmentError);
  });
});

// ── 3. Build idempotency ────────────────────────────────────────────────────────────────────

describe("buildOrRefreshIndex idempotency", () => {
  beforeEach(setRuntimeEnv);

  it("skips (in_progress) when the build claim is lost to a concurrent dispatch", async () => {
    install((url, init) => {
      // ensureRagIndex upsert
      if (url.includes("/rest/v1/pa_rag_indexes?on_conflict")) return { status: 201, body: null };
      // claimBuild PATCH (status=neq.building) → empty array = claim NOT acquired
      if (url.includes("/rest/v1/pa_rag_indexes") && (init?.method ?? "").toUpperCase() === "PATCH") {
        return { status: 200, body: [] };
      }
      return { status: 200, body: {} };
    });

    const out = await buildOrRefreshIndex({
      ownerId: OWNER,
      zonePath: "memory",
      docs: [{ docPath: "memory/a.md", text: "hello" }],
    });
    expect(out.status).toBe("skipped");
    if (out.status === "skipped") expect(out.reason).toBe("in_progress");
    expect(modalCalled("/rag/build")).toBe(false);
  });

  it("builds and stamps the catalog when the claim is acquired", async () => {
    install((url, init) => {
      if (url.includes("/rest/v1/pa_rag_indexes?on_conflict")) return { status: 201, body: null };
      if (url.includes("/rest/v1/pa_rag_indexes") && (init?.method ?? "").toUpperCase() === "PATCH") {
        // claim acquired (one row) for the neq.building PATCH; markReady PATCH returns minimal
        return { status: 200, body: [catalogRow({ status: "building" })] };
      }
      if (url.includes("/rag/build")) {
        return {
          status: 200,
          body: { ok: true, docCount: 150, tokenCount: 80_000, embeddingTokens: 12_345, dim: 1536, cpuSeconds: 2.5 },
        };
      }
      if (url.includes("/rest/v1/pa_cost_events")) return { status: 201, body: null };
      return { status: 200, body: {} };
    });

    const docs = Array.from({ length: 150 }, (_, i) => ({ docPath: `memory/m${i}.md`, text: `doc ${i}` }));
    const out = await buildOrRefreshIndex({ ownerId: OWNER, zonePath: "memory", docs });
    expect(out.status).toBe("built");
    if (out.status === "built") expect(out.docCount).toBe(150);
    expect(modalCalled("/rag/build")).toBe(true);
    // Cost ledger: one embed row + one modal row.
    expect(calls.filter((c) => c.url.includes("/rest/v1/pa_cost_events")).length).toBe(2);
  });
});

// ── 4. Integration: synthetic 150-doc zone end-to-end ──────────────────────────────────────────

describe("integration: 150-doc zone vector query", () => {
  beforeEach(setRuntimeEnv);

  it("vector-searches and returns zone-filtered hits with cost ledger writes", async () => {
    install((url) => {
      if (url.includes("/rest/v1/pa_rag_indexes")) {
        return { status: 200, body: [catalogRow({ doc_count: 150, token_count: 80_000 })] };
      }
      if (url.includes("/rag/query")) {
        return {
          status: 200,
          body: {
            ok: true,
            results: [
              { docPath: "memory/knowledge/pricing.md", score: 0.94, snippet: "Our pricing is…" },
              { docPath: "memory/work/refunds.md", score: 0.88, snippet: "Refunds within 30 days…" },
              // an out-of-zone path the belt must drop even if the runtime slipped
              { docPath: "finance/private.md", score: 0.99, snippet: "secret" },
            ],
            embeddingTokens: 24,
            cpuSeconds: 0.4,
          },
        };
      }
      if (url.includes("/rest/v1/pa_cost_events")) return { status: 201, body: null };
      return { status: 200, body: {} };
    });

    const out = await queryRag({ ownerId: OWNER, zonePath: "memory", query: "how do refunds work", topN: 8 });
    expect(out.source).toBe("turbovec");
    if (out.source === "turbovec") {
      expect(out.hits.map((h) => h.docPath)).toEqual([
        "memory/knowledge/pricing.md",
        "memory/work/refunds.md",
      ]);
    }
    expect(modalCalled("/rag/query")).toBe(true);
    expect(calls.filter((c) => c.url.includes("/rest/v1/pa_cost_events")).length).toBe(2);
  });
});
