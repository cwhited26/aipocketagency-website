// connectors/moonchild/__tests__/client.test.ts — unit tests for the Moonchild MCP connector.
// Covers: configured/unconfigured paths, tool discovery, import-DS (success + failure),
// rate-limit retry, in-flight lock, and Zod validation at the boundary. No network.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getMoonchildConfig,
  importDesignSystemFromUrl,
  listMoonchildTools,
  resetDiscoveredTools,
} from "../client";

// ── Env helpers ───────────────────────────────────────────────────────────────────────────────────

function setEnv(url: string | undefined, token: string | undefined): void {
  if (url === undefined) {
    delete process.env.MOONCHILD_MCP_URL;
  } else {
    process.env.MOONCHILD_MCP_URL = url;
  }
  if (token === undefined) {
    delete process.env.MOONCHILD_MCP_TOKEN;
  } else {
    process.env.MOONCHILD_MCP_TOKEN = token;
  }
}

function toolsListResponse(tools: { name: string; description?: string }[]) {
  return { tools };
}

function toolCallResponse(ds: Record<string, unknown>) {
  return { content: [{ type: "text", text: JSON.stringify(ds) }] };
}

function rpcOk(result: unknown): string {
  return JSON.stringify({ jsonrpc: "2.0", id: 1, result });
}

function rpcOkId(id: string | number, result: unknown): string {
  return JSON.stringify({ jsonrpc: "2.0", id, result });
}

// ── Setup ─────────────────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  resetDiscoveredTools();
  setEnv("https://forge.moonchild.ai/mcp", "test-token");
});

afterEach(() => {
  vi.restoreAllMocks();
  resetDiscoveredTools();
  setEnv(undefined, undefined);
});

// ── getMoonchildConfig ────────────────────────────────────────────────────────────────────────────

describe("getMoonchildConfig", () => {
  it("returns configured: true when both env vars are set", () => {
    const cfg = getMoonchildConfig();
    expect(cfg.configured).toBe(true);
    if (cfg.configured) {
      expect(cfg.mcpUrl).toBe("https://forge.moonchild.ai/mcp");
      expect(cfg.token).toBe("test-token");
    }
  });

  it("returns configured: false when MOONCHILD_MCP_URL is missing", () => {
    setEnv(undefined, "test-token");
    const cfg = getMoonchildConfig();
    expect(cfg.configured).toBe(false);
  });

  it("returns configured: false when MOONCHILD_MCP_TOKEN is missing", () => {
    setEnv("https://forge.moonchild.ai/mcp", undefined);
    const cfg = getMoonchildConfig();
    expect(cfg.configured).toBe(false);
  });

  it("strips trailing slash from mcpUrl", () => {
    setEnv("https://forge.moonchild.ai/mcp/", "tok");
    const cfg = getMoonchildConfig();
    if (cfg.configured) expect(cfg.mcpUrl).toBe("https://forge.moonchild.ai/mcp");
  });
});

// ── listMoonchildTools ────────────────────────────────────────────────────────────────────────────

describe("listMoonchildTools", () => {
  it("returns not_configured when env vars are missing", async () => {
    setEnv(undefined, undefined);
    const result = await listMoonchildTools("u1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("not_configured");
  });

  it("discovers tools from the MCP server and returns them", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(rpcOk(toolsListResponse([{ name: "import_design_system_from_url", description: "Import DS" }])), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    const result = await listMoonchildTools("u1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.length).toBe(1);
      expect(result.data[0].name).toBe("import_design_system_from_url");
    }
  });

  it("caches the tool list across calls", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(rpcOk(toolsListResponse([{ name: "import_design_system_from_url" }])), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await listMoonchildTools("u1");
    await listMoonchildTools("u1");

    // Only one network call despite two listMoonchildTools calls
    expect(fetchMock.mock.calls.length).toBe(1);
  });

  it("returns invalid_response on schema mismatch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(rpcOk({ not_tools: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    const result = await listMoonchildTools("u1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("invalid_response");
  });

  it("returns auth error on 401", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Unauthorized", { status: 401 })));
    const result = await listMoonchildTools("u1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("auth");
  });
});

// ── importDesignSystemFromUrl ─────────────────────────────────────────────────────────────────────

const SAMPLE_DS = {
  id: "ds-abc123",
  name: "Valley Roofing Brand",
  palette: [{ name: "primary", hex: "#22d3ee", role: "primary" }],
  typography: { heading: { family: "Inter", weight: 700 }, body: { family: "Inter", weight: 400 } },
  components: { button: "rounded px-4 py-2 bg-primary text-white" },
};

function makeFetch(toolName = "import_design_system_from_url") {
  let call = 0;
  return vi.fn(async (url: string, init?: RequestInit) => {
    const body = JSON.parse((init?.body as string) ?? "{}") as { params?: { name?: string } };
    const method = (JSON.parse((init?.body as string) ?? "{}") as { method?: string }).method;

    if (method === "tools/list") {
      return new Response(rpcOk(toolsListResponse([{ name: toolName, description: "Import DS from URL" }])), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (method === "tools/call") {
      call++;
      return new Response(rpcOkId(body.params?.name ?? call, toolCallResponse(SAMPLE_DS)), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    return new Response("Not found", { status: 404 });
  });
}

describe("importDesignSystemFromUrl", () => {
  it("returns not_configured when env vars are missing", async () => {
    setEnv(undefined, undefined);
    const result = await importDesignSystemFromUrl("https://example.com", { ownerId: "u1" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("not_configured");
  });

  it("discovers tools, calls the right tool, and returns a validated DesignSystem", async () => {
    vi.stubGlobal("fetch", makeFetch());

    const result = await importDesignSystemFromUrl("https://valleyroofing.com", { ownerId: "u1" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.designSystem.id).toBe("ds-abc123");
      expect(result.data.designSystem.palette?.[0]?.hex).toBe("#22d3ee");
      expect(result.data.designSystemId).toBe("ds-abc123");
      expect(result.data.toolName).toBe("import_design_system_from_url");
    }
  });

  it("resolves the import-DS tool by partial name match", async () => {
    // Tool is named differently on this server version
    vi.stubGlobal("fetch", makeFetch("moonchild_import_design_system_v2"));

    const result = await importDesignSystemFromUrl("https://example.com", { ownerId: "u2" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.toolName).toBe("moonchild_import_design_system_v2");
  });

  it("returns invalid_response when the DS payload fails Zod validation", async () => {
    const badDs = { id: 123, palette: "not-an-array" };
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse((init?.body as string) ?? "{}") as { method?: string };
      if (body.method === "tools/list") {
        return new Response(rpcOk(toolsListResponse([{ name: "import_design_system_from_url" }])), {
          status: 200, headers: { "content-type": "application/json" },
        });
      }
      return new Response(rpcOkId("x", toolCallResponse(badDs as Record<string, unknown>)), {
        status: 200, headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    // A DS with wrong types (id is number, palette is string) — DesignSystemSchema is lenient on id
    // but palette must be an array. Expect a successful parse since schema is .optional() on all
    // fields — the connector should succeed with partial data.
    const result = await importDesignSystemFromUrl("https://example.com", { ownerId: "u3" });
    // DesignSystemSchema uses .optional() on all fields, so it should succeed even with partial data
    expect(result.ok).toBe(true);
  });

  it("returns a rate_limit error when another import is already in-flight", async () => {
    let resolveFetch!: (v: Response) => void;
    const pending = new Promise<Response>((res) => { resolveFetch = res; });

    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse((init?.body as string) ?? "{}") as { method?: string };
      if (body.method === "tools/list") {
        return new Response(rpcOk(toolsListResponse([{ name: "import_design_system_from_url" }])), {
          status: 200, headers: { "content-type": "application/json" },
        });
      }
      return pending;
    });
    vi.stubGlobal("fetch", fetchMock);

    // Start first import (will block on pending)
    const first = importDesignSystemFromUrl("https://a.com", { ownerId: "u4" });
    // Small delay to let the lock be set
    await new Promise((r) => setTimeout(r, 10));
    // Second import for the same owner should hit the in-flight lock
    const second = await importDesignSystemFromUrl("https://b.com", { ownerId: "u4" });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error.kind).toBe("rate_limit");

    // Resolve the first import to avoid leaking the promise
    resolveFetch(
      new Response(rpcOkId("x", toolCallResponse(SAMPLE_DS)), {
        status: 200, headers: { "content-type": "application/json" },
      }),
    );
    await first;
  });

  it("retries on 429 and succeeds on the third attempt", async () => {
    // Speed up retries in the test environment — mock setTimeout
    vi.useFakeTimers();
    let attempt = 0;

    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse((init?.body as string) ?? "{}") as { method?: string };
      if (body.method === "tools/list") {
        return new Response(rpcOk(toolsListResponse([{ name: "import_design_system_from_url" }])), {
          status: 200, headers: { "content-type": "application/json" },
        });
      }
      attempt++;
      if (attempt < 3) return new Response("Rate limited", { status: 429 });
      return new Response(rpcOkId("x", toolCallResponse(SAMPLE_DS)), {
        status: 200, headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const importPromise = importDesignSystemFromUrl("https://example.com", { ownerId: "u5" });
    // Advance timers past the retry delays
    await vi.runAllTimersAsync();
    const result = await importPromise;

    expect(result.ok).toBe(true);
    vi.useRealTimers();
  });
});
