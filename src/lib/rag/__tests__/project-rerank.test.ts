// project-rerank.test.ts — the project-zone adopter swap (PA-RAG-8, extra #1).
//
// buildProjectContextBlock now re-orders project references + memory to the turbovec relevance ranking
// for the chat turn when the zone is over threshold and its index is ready; below threshold (or with
// no query) it leaves the newest-first order untouched — the pre-lane behavior. These two tests pin
// both halves of that swap end-to-end through a mocked Supabase + Modal.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildProjectContextBlock } from "@/lib/pa-projects";

type Handler = (url: string, init: RequestInit | undefined) => { status: number; body: unknown };

function install(handler: Handler): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
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
const PROJECT = "p1";

function projectRow(): unknown {
  return {
    id: PROJECT,
    owner_id: OWNER,
    title: "Acme rebrand",
    goal: null,
    instructions: null,
    scaffold_slug: null,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
  };
}

// 150 references (> the 100-doc threshold) so the references zone goes vector; ids ref0..ref149, each
// returned newest-first by the data layer (the order the block would use without re-ranking).
function references(): unknown[] {
  return Array.from({ length: 150 }, (_, i) => ({
    id: `ref${i}`,
    project_id: PROJECT,
    owner_id: OWNER,
    file_path: null,
    file_name: `ref${i}.md`,
    content_text: `reference content ${i}`,
    created_at: "2026-06-01T00:00:00Z",
  }));
}

function memoryRows(): unknown[] {
  return Array.from({ length: 3 }, (_, i) => ({
    id: `mem${i}`,
    project_id: PROJECT,
    owner_id: OWNER,
    body: `memory note ${i}`,
    created_at: "2026-06-01T00:00:00Z",
  }));
}

function readyCatalogRow(): unknown {
  return {
    id: "idx-1",
    owner_id: OWNER,
    zone_path: "project/p1/references",
    zone_type: "project",
    embedding_model: "text-embedding-3-small",
    doc_count: 150,
    token_count: 0,
    status: "ready",
    last_built_at: "2026-06-08T00:00:00Z",
    last_error: null,
    change_cursor: {},
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-08T00:00:00Z",
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("buildProjectContextBlock re-ranks an over-threshold project zone", () => {
  beforeEach(setRuntimeEnv);

  it("orders references by turbovec relevance for the query", async () => {
    install((url) => {
      if (url.includes("/rest/v1/pa_projects")) return { status: 200, body: [projectRow()] };
      if (url.includes("/rest/v1/pa_project_references")) return { status: 200, body: references() };
      if (url.includes("/rest/v1/pa_project_memory")) return { status: 200, body: memoryRows() };
      if (url.includes("/rest/v1/pa_rag_indexes")) return { status: 200, body: [readyCatalogRow()] };
      if (url.includes("/rag/query")) {
        return {
          status: 200,
          body: {
            ok: true,
            results: [
              { docPath: "project/p1/references/ref5", score: 0.95, snippet: "" },
              { docPath: "project/p1/references/ref2", score: 0.9, snippet: "" },
              { docPath: "project/p1/references/ref0", score: 0.8, snippet: "" },
            ],
            embeddingTokens: 10,
            cpuSeconds: 0.1,
          },
        };
      }
      if (url.includes("/rest/v1/pa_cost_events")) return { status: 201, body: null };
      return { status: 200, body: {} };
    });

    const out = await buildProjectContextBlock(PROJECT, OWNER, "how did we handle the logo refresh");
    expect(out).not.toBeNull();
    const block = out!.block;
    // The three ranked references come first, in score order, ahead of the unranked rest.
    const at = (name: string) => block.indexOf(`--- ${name} ---`);
    expect(at("ref5.md")).toBeGreaterThan(-1);
    expect(at("ref5.md")).toBeLessThan(at("ref2.md"));
    expect(at("ref2.md")).toBeLessThan(at("ref0.md"));
    expect(at("ref0.md")).toBeLessThan(at("ref1.md")); // ref1 was not ranked → sinks below the ranked
  });
});

describe("buildProjectContextBlock leaves a small project untouched", () => {
  beforeEach(setRuntimeEnv);

  it("never calls Modal and keeps newest-first order for a sub-threshold reference set", async () => {
    let modalQueried = false;
    install((url) => {
      if (url.includes("/rest/v1/pa_projects")) return { status: 200, body: [projectRow()] };
      if (url.includes("/rest/v1/pa_project_references")) {
        return {
          status: 200,
          body: [
            { id: "refA", project_id: PROJECT, owner_id: OWNER, file_path: null, file_name: "refA.md", content_text: "a", created_at: "2026-06-02T00:00:00Z" },
            { id: "refB", project_id: PROJECT, owner_id: OWNER, file_path: null, file_name: "refB.md", content_text: "b", created_at: "2026-06-01T00:00:00Z" },
          ],
        };
      }
      if (url.includes("/rest/v1/pa_project_memory")) return { status: 200, body: [] };
      if (url.includes("/rest/v1/pa_rag_indexes")) return { status: 200, body: [readyCatalogRow()] };
      if (url.includes("/rag/query")) {
        modalQueried = true;
        return { status: 200, body: { ok: true, results: [], embeddingTokens: 0, cpuSeconds: 0 } };
      }
      return { status: 200, body: {} };
    });

    const out = await buildProjectContextBlock(PROJECT, OWNER, "anything");
    expect(out).not.toBeNull();
    const block = out!.block;
    expect(block.indexOf("--- refA.md ---")).toBeLessThan(block.indexOf("--- refB.md ---"));
    expect(modalQueried).toBe(false); // two refs is below threshold → no vector query
  });
});
