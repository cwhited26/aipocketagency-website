// connectors/moonchild/client.ts — HTTP MCP client for the Moonchild design-system connector.
//
// Speaks HTTP MCP per the official MCP spec: POST JSON-RPC 2.0 to MOONCHILD_MCP_URL with
// Authorization: Bearer <token>. Direct fetch — no MCP SDK import (the repo's SDK ban rule).
//
// On first use the connector discovers the server's tool list (tools/list), logs the discovered
// names via the structured logger, and stores them in module memory for the session lifetime.
// The importDesignSystemFromUrl wrapper then calls the real "Import Design System" tool by its
// discovered name — so if Moonchild renames the tool the connector still works on next deploy.
//
// Rate-limit / retry posture: one in-flight call per (ownerId, kind) via a simple Set lock.
// Exponential back-off on 429/5xx, cap 3 retries, 1s / 2s / 4s delays. (PA-LPB-11)

import { z } from "zod";
import {
  DesignSystemSchema,
  DesignSystemBundleSchema,
  McpToolsListResponseSchema,
  MoonchildScenesResponseSchema,
  type ConnectorError,
  type ConnectorResult,
  type DesignSystem,
  type ImportDesignSystemResult,
  type McpTool,
  type MoonchildConfig,
  type MoonchildScene,
  type SceneImportResult,
} from "./types";

// ── Structured logger ─────────────────────────────────────────────────────────────────────────────

type LogFields = Record<string, unknown>;
type Level = "info" | "warn" | "error";

function emit(level: Level, msg: string, fields?: LogFields): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    scope: "connectors.moonchild",
    level,
    msg,
    ...(fields ?? {}),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

const log = {
  info: (msg: string, f?: LogFields) => emit("info", msg, f),
  warn: (msg: string, f?: LogFields) => emit("warn", msg, f),
  error: (msg: string, f?: LogFields) => emit("error", msg, f),
};

// ── Config resolution ─────────────────────────────────────────────────────────────────────────────

export function getMoonchildConfig(): MoonchildConfig {
  const mcpUrl = process.env.MOONCHILD_MCP_URL;
  const token = process.env.MOONCHILD_MCP_TOKEN;
  if (!mcpUrl || !token) {
    return {
      configured: false,
      reason: "Set MOONCHILD_MCP_URL and MOONCHILD_MCP_TOKEN environment variables to enable the Moonchild design-system connector.",
    };
  }
  return { configured: true, mcpUrl: mcpUrl.replace(/\/$/, ""), token };
}

// ── In-flight lock (one call per ownerId+kind at a time) ─────────────────────────────────────────

const inFlight = new Set<string>();

function lockKey(ownerId: string, kind: string): string {
  return `${ownerId}:${kind}`;
}

// ── Discovered tools (session-lifetime cache) ─────────────────────────────────────────────────────

let discoveredTools: McpTool[] | null = null;

// ── MCP JSON-RPC transport with retry ────────────────────────────────────────────────────────────

type McpRequest = {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: unknown;
};

type McpResponse =
  | { jsonrpc: "2.0"; id: string | number; result: unknown }
  | { jsonrpc: "2.0"; id: string | number; error: { code: number; message: string; data?: unknown } };

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mcpCall(
  config: { mcpUrl: string; token: string },
  req: McpRequest,
  correlationId: string,
  ownerId: string,
): Promise<ConnectorResult<unknown>> {
  const maxRetries = 3;
  const delays = [1000, 2000, 4000];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let res: Response;
    try {
      res = await fetch(config.mcpUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.token}`,
          "X-Correlation-Id": correlationId,
        },
        body: JSON.stringify(req),
        cache: "no-store",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "network error";
      log.error("moonchild fetch error", { owner_id: ownerId, correlation_id: correlationId, attempt, error: msg });
      if (attempt === maxRetries) {
        return { ok: false, error: { kind: "network", message: msg, retryable: false } };
      }
      await sleep(delays[attempt] ?? 4000);
      continue;
    }

    if (res.status === 401 || res.status === 403) {
      log.error("moonchild auth error", { owner_id: ownerId, correlation_id: correlationId, status: res.status });
      return { ok: false, error: { kind: "auth", message: `Moonchild returned ${res.status}. Check MOONCHILD_MCP_TOKEN.`, retryable: false } };
    }

    if (res.status === 429 || res.status >= 500) {
      log.warn("moonchild retryable error", { owner_id: ownerId, correlation_id: correlationId, status: res.status, attempt });
      if (attempt === maxRetries) {
        return {
          ok: false,
          error: {
            kind: res.status === 429 ? "rate_limit" : "network",
            message: `Moonchild returned ${res.status} after ${maxRetries + 1} attempts.`,
            retryable: false,
          },
        };
      }
      await sleep(delays[attempt] ?? 4000);
      continue;
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      log.error("moonchild non-retryable error", { owner_id: ownerId, correlation_id: correlationId, status: res.status, body: body.slice(0, 200) });
      return { ok: false, error: { kind: "network", message: `Moonchild returned ${res.status}: ${body.slice(0, 200)}`, retryable: false } };
    }

    let json: unknown;
    try {
      json = await res.json();
    } catch (parseErr) {
      const msg = parseErr instanceof Error ? parseErr.message : "JSON parse error";
      log.error("moonchild parse error", { owner_id: ownerId, correlation_id: correlationId, error: msg });
      return { ok: false, error: { kind: "invalid_response", message: `Moonchild returned invalid JSON: ${msg}`, retryable: false } };
    }

    const rpc = json as McpResponse;
    if ("error" in rpc && rpc.error) {
      const rpcErr = rpc.error;
      log.error("moonchild rpc error", { owner_id: ownerId, correlation_id: correlationId, code: rpcErr.code, message: rpcErr.message });
      return { ok: false, error: { kind: "invalid_response", message: `Moonchild RPC error ${rpcErr.code}: ${rpcErr.message}`, retryable: false } };
    }

    return { ok: true, data: (rpc as { result: unknown }).result };
  }

  return { ok: false, error: { kind: "network", message: "Exhausted retries", retryable: false } };
}

// ── Tool discovery ────────────────────────────────────────────────────────────────────────────────

function notConfigured(): ConnectorResult<never> {
  const cfg = getMoonchildConfig();
  const reason = cfg.configured ? "" : cfg.reason;
  return {
    ok: false,
    error: { kind: "not_configured", message: reason || "Moonchild connector is not configured.", retryable: false },
  };
}

/**
 * Discover the tools the Moonchild MCP server publishes. Result is cached for the process lifetime.
 * Logs the discovered tool names via the structured logger (PA-LPB-11 — never console.log).
 */
export async function listMoonchildTools(ownerId = "system"): Promise<ConnectorResult<McpTool[]>> {
  if (discoveredTools !== null) return { ok: true, data: discoveredTools };

  const config = getMoonchildConfig();
  if (!config.configured) return notConfigured();

  const correlationId = `discover-${Date.now()}`;
  const result = await mcpCall(
    config,
    { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} },
    correlationId,
    ownerId,
  );

  if (!result.ok) return result;

  const parsed = McpToolsListResponseSchema.safeParse(result.data);
  if (!parsed.success) {
    log.error("moonchild tools/list schema mismatch", { owner_id: ownerId, correlation_id: correlationId, error: parsed.error.message });
    return { ok: false, error: { kind: "invalid_response", message: `tools/list response did not match expected shape: ${parsed.error.message}`, retryable: false } };
  }

  discoveredTools = parsed.data.tools;

  // Log every discovered tool name — the standing rule for connector discovery (PA-LPB-11).
  log.info("moonchild tools discovered", {
    owner_id: ownerId,
    correlation_id: correlationId,
    tool_names: discoveredTools.map((t) => t.name),
    tool_count: discoveredTools.length,
  });

  return { ok: true, data: discoveredTools };
}

// ── Tool name resolution ──────────────────────────────────────────────────────────────────────────

// Keywords we use to identify the "import design system" tool by partial name matching when the
// actual tool name is unknown at authoring time. The first tool whose name contains any of these
// tokens (case-insensitive) is used. If none match, we fall back to the first tool in the list.
const IMPORT_DS_KEYWORDS = [
  "import_design_system",
  "import-design-system",
  "importdesignsystem",
  "design_system",
  "design-system",
  "designsystem",
  "import_design",
  "extract_design",
];

function findImportDsTool(tools: McpTool[]): McpTool | null {
  for (const keyword of IMPORT_DS_KEYWORDS) {
    const match = tools.find((t) => t.name.toLowerCase().includes(keyword.toLowerCase()));
    if (match) return match;
  }
  return tools[0] ?? null;
}

// ── importDesignSystemFromUrl ─────────────────────────────────────────────────────────────────────

/**
 * Import a design system from a live URL via the Moonchild MCP server.
 *
 * The tool name is resolved from the server's discovered tool list — the connector never hardcodes
 * a name that might have changed. If the server has renamed the tool since this session started,
 * clear `discoveredTools` (restart) and the next call will re-discover. (PA-LPB-11)
 *
 * One in-flight call per (ownerId, "import_ds") at a time — concurrent calls from the same owner
 * queue naturally because the second call would hit the in-flight lock and return a "busy" error
 * rather than firing two Moonchild calls simultaneously.
 */
export async function importDesignSystemFromUrl(
  url: string,
  options: { ownerId: string; correlationId?: string },
): Promise<ConnectorResult<ImportDesignSystemResult>> {
  const config = getMoonchildConfig();
  if (!config.configured) return notConfigured();

  const lockK = lockKey(options.ownerId, "import_ds");
  if (inFlight.has(lockK)) {
    return {
      ok: false,
      error: { kind: "rate_limit", message: "A design-system import is already in progress for this owner. Wait for it to finish.", retryable: true },
    };
  }

  inFlight.add(lockK);
  const correlationId = options.correlationId ?? `import-ds-${Date.now()}`;

  // PA-LPB-13: this code path is end-of-life. The Moonchild MCP at forge.moonchild.ai/mcp is
  // read-only (13 export tools, zero generation tools). There is no "import design system from URL"
  // tool on the server — findImportDsTool either falls back to tools[0] or returns null. The
  // PA_MOONCHILD_URL_IMPORT_ENABLED flag gates the wizard option; it is intentionally unset in
  // production so this branch is unreachable from the UI until PA-LPB-13 ships the correct flow.
  log.warn("moonchild import-ds-from-url called — this code path is end-of-life pending PA-LPB-13", {
    owner_id: options.ownerId,
    correlation_id: correlationId,
    url,
    note: "Moonchild MCP is read-only. PA-LPB-13 replaces this with scene-pick (Path A) and URL-cloner (Path B).",
  });

  try {
    const toolsResult = await listMoonchildTools(options.ownerId);
    if (!toolsResult.ok) return toolsResult;

    const tool = findImportDsTool(toolsResult.data);
    if (!tool) {
      log.error("moonchild import-ds tool not found", { owner_id: options.ownerId, correlation_id: correlationId });
      return {
        ok: false,
        error: { kind: "tool_not_found", message: "Moonchild did not expose a design-system import tool. Check the server version.", retryable: false },
      };
    }

    log.info("moonchild import-ds start", { owner_id: options.ownerId, correlation_id: correlationId, url, tool_name: tool.name });

    const callResult = await mcpCall(
      config,
      {
        jsonrpc: "2.0",
        id: correlationId,
        method: "tools/call",
        params: { name: tool.name, arguments: { url, format: "json" } },
      },
      correlationId,
      options.ownerId,
    );

    if (!callResult.ok) return callResult;

    // The MCP tools/call result wraps the tool output in `content`.
    const rawContent = extractToolContent(callResult.data);

    const parsed = DesignSystemSchema.safeParse(rawContent);
    if (!parsed.success) {
      log.error("moonchild import-ds schema mismatch", {
        owner_id: options.ownerId,
        correlation_id: correlationId,
        tool_name: tool.name,
        error: parsed.error.message,
      });
      return {
        ok: false,
        error: { kind: "invalid_response", message: `Moonchild returned a design system in an unexpected shape: ${parsed.error.message}`, retryable: false },
      };
    }

    const ds = parsed.data;
    const designSystemId = typeof ds.id === "string" && ds.id ? ds.id : correlationId;

    log.info("moonchild import-ds success", {
      owner_id: options.ownerId,
      correlation_id: correlationId,
      url,
      tool_name: tool.name,
      design_system_id: designSystemId,
      palette_count: ds.palette?.length ?? 0,
    });

    return {
      ok: true,
      data: { designSystem: ds, designSystemId, toolName: tool.name },
    };
  } finally {
    inFlight.delete(lockK);
  }
}

// ── Content extraction ────────────────────────────────────────────────────────────────────────────

/**
 * The MCP `tools/call` result wraps the real payload in a `content` array of content-blocks.
 * This extracts the first `text` block and attempts JSON.parse; falls back to returning the
 * raw result if the shape doesn't match or parsing fails.
 */
function extractToolContent(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const result = raw as Record<string, unknown>;

  // Standard MCP tools/call shape: { content: [{type: "text", text: "..."}] }
  const content = result["content"];
  if (Array.isArray(content) && content.length > 0) {
    const first = content[0] as Record<string, unknown>;
    if (first.type === "text" && typeof first.text === "string") {
      try {
        return JSON.parse(first.text) as unknown;
      } catch {
        return first.text;
      }
    }
    // Some servers use type "json" with a data key
    if (first.type === "json" && first.data !== undefined) {
      return first.data;
    }
  }

  // Servers that return the object directly (non-standard but common)
  return raw;
}

// ── generateUiFromPrd (future expansion, PA-LPB-12) ──────────────────────────────────────────────

/**
 * Generate a UI flow from a PRD string using the Moonchild server's PRD-to-UI tool, if published.
 * Wraps the tool by keyword-matching "prd", "ui_flow", "generate_ui". No-op returning null when
 * the server does not publish a matching tool — callers must handle null gracefully.
 */
export async function generateUiFromPrd(
  prd: string,
  designSystemId: string,
  options: { ownerId: string; correlationId?: string },
): Promise<ConnectorResult<Record<string, unknown>> | null> {
  const config = getMoonchildConfig();
  if (!config.configured) return null;

  const toolsResult = await listMoonchildTools(options.ownerId);
  if (!toolsResult.ok) return null;

  const PRD_KEYWORDS = ["prd", "ui_flow", "generate_ui", "ui-flow", "generate-ui"];
  const tool = toolsResult.data.find((t) =>
    PRD_KEYWORDS.some((kw) => t.name.toLowerCase().includes(kw)),
  );
  if (!tool) return null;

  const correlationId = options.correlationId ?? `prd-${Date.now()}`;
  const result = await mcpCall(
    config,
    { jsonrpc: "2.0", id: correlationId, method: "tools/call", params: { name: tool.name, arguments: { prd, design_system_id: designSystemId } } },
    correlationId,
    options.ownerId,
  );

  if (!result.ok) return result;
  const content = extractToolContent(result.data);
  const obj = z.record(z.string(), z.unknown()).safeParse(content);
  if (!obj.success) return null;
  return { ok: true, data: obj.data };
}

// ── Path A: BYO-credential functions (PA-LPB-13) ─────────────────────────────────────────────────
// These functions take explicit { mcpUrl, token } credentials from the owner's pa_connections row
// rather than from the MOONCHILD_MCP_URL / MOONCHILD_MCP_TOKEN env vars. They do NOT use the
// module-level discoveredTools cache — each call discovers tools fresh with the owner's token.

type OwnerCredentials = { mcpUrl: string; token: string };

const SCENE_LIST_KEYWORDS = ["scene_list", "list_scenes", "scenes/list", "frame_list", "list_frames"];
const DS_BUNDLE_KEYWORDS = ["design_system_get_bundle", "design_system_bundle", "get_bundle", "ds_bundle"];

async function listToolsWithCredentials(
  creds: OwnerCredentials,
  ownerId: string,
): Promise<ConnectorResult<McpTool[]>> {
  const correlationId = `discover-byo-${Date.now()}`;
  const result = await mcpCall(
    { mcpUrl: creds.mcpUrl.replace(/\/$/, ""), token: creds.token },
    { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} },
    correlationId,
    ownerId,
  );
  if (!result.ok) return result;

  const parsed = McpToolsListResponseSchema.safeParse(result.data);
  if (!parsed.success) {
    log.error("moonchild byo tools/list schema mismatch", { owner_id: ownerId, error: parsed.error.message });
    return { ok: false, error: { kind: "invalid_response", message: `tools/list response did not match expected shape: ${parsed.error.message}`, retryable: false } };
  }
  return { ok: true, data: parsed.data.tools };
}

/**
 * List the owner's Moonchild scenes using their own msk_* token.
 * Calls the scene_list (or equivalent) tool discovered on the server.
 */
export async function listMoonchildScenesWithCredentials(
  creds: OwnerCredentials,
  ownerId: string,
): Promise<ConnectorResult<MoonchildScene[]>> {
  const toolsResult = await listToolsWithCredentials(creds, ownerId);
  if (!toolsResult.ok) return toolsResult;

  const tool = toolsResult.data.find((t) =>
    SCENE_LIST_KEYWORDS.some((kw) => t.name.toLowerCase().includes(kw.toLowerCase())),
  );
  if (!tool) {
    log.warn("moonchild scene_list tool not found", {
      owner_id: ownerId,
      available_tools: toolsResult.data.map((t) => t.name),
    });
    return {
      ok: false,
      error: { kind: "tool_not_found", message: "Moonchild didn't expose a scene-list tool. Check that your token has the right scopes.", retryable: false },
    };
  }

  const correlationId = `scene-list-${Date.now()}`;
  log.info("moonchild scene_list start", { owner_id: ownerId, tool_name: tool.name, correlation_id: correlationId });

  const result = await mcpCall(
    { mcpUrl: creds.mcpUrl.replace(/\/$/, ""), token: creds.token },
    { jsonrpc: "2.0", id: correlationId, method: "tools/call", params: { name: tool.name, arguments: {} } },
    correlationId,
    ownerId,
  );
  if (!result.ok) return result;

  const content = extractToolContent(result.data);
  const parsed = MoonchildScenesResponseSchema.safeParse(content);
  if (!parsed.success) {
    log.error("moonchild scene_list schema mismatch", { owner_id: ownerId, tool_name: tool.name, error: parsed.error.message });
    return { ok: false, error: { kind: "invalid_response", message: `scene_list returned an unexpected shape: ${parsed.error.message}`, retryable: false } };
  }

  log.info("moonchild scene_list success", { owner_id: ownerId, scene_count: parsed.data.scenes.length });
  return { ok: true, data: parsed.data.scenes };
}

/**
 * Fetch the design system bundle for a scene using the owner's msk_* token.
 * Calls design_system_get_bundle (or equivalent) — the tool PA-LPB-13 uses as the authoritative
 * DS source (as noted in the brain standing rule).
 *
 * @param sceneId — The scene id from listMoonchildScenesWithCredentials. Optional; if absent, the
 *   tool is called without a scene id (some versions return the project-level DS).
 */
export async function getDesignSystemBundleWithCredentials(
  creds: OwnerCredentials,
  ownerId: string,
  sceneId?: string,
): Promise<ConnectorResult<SceneImportResult>> {
  const toolsResult = await listToolsWithCredentials(creds, ownerId);
  if (!toolsResult.ok) return toolsResult;

  const tool = toolsResult.data.find((t) =>
    DS_BUNDLE_KEYWORDS.some((kw) => t.name.toLowerCase().includes(kw.toLowerCase())),
  );
  if (!tool) {
    log.warn("moonchild design_system_get_bundle tool not found", {
      owner_id: ownerId,
      available_tools: toolsResult.data.map((t) => t.name),
    });
    return {
      ok: false,
      error: { kind: "tool_not_found", message: "Moonchild didn't expose a design-system bundle tool. Make sure the MCP server is up to date.", retryable: false },
    };
  }

  const correlationId = `ds-bundle-${Date.now()}`;
  const toolArgs: Record<string, unknown> = {};
  if (sceneId) toolArgs["scene_id"] = sceneId;

  log.info("moonchild ds_bundle start", { owner_id: ownerId, tool_name: tool.name, scene_id: sceneId ?? null, correlation_id: correlationId });

  const result = await mcpCall(
    { mcpUrl: creds.mcpUrl.replace(/\/$/, ""), token: creds.token },
    { jsonrpc: "2.0", id: correlationId, method: "tools/call", params: { name: tool.name, arguments: toolArgs } },
    correlationId,
    ownerId,
  );
  if (!result.ok) return result;

  const content = extractToolContent(result.data);

  // Try to find the DS in the bundle wrapper — some versions nest it, some return it at root.
  const bundleParsed = DesignSystemBundleSchema.safeParse(content);
  const rawDs = bundleParsed.success
    ? (bundleParsed.data.design_system ?? bundleParsed.data.bundle ?? content)
    : content;

  const dsParsed = DesignSystemSchema.safeParse(rawDs);
  if (!dsParsed.success) {
    log.error("moonchild ds_bundle schema mismatch", { owner_id: ownerId, tool_name: tool.name, error: dsParsed.error.message });
    return {
      ok: false,
      error: { kind: "invalid_response", message: `design_system_get_bundle returned an unexpected shape: ${dsParsed.error.message}`, retryable: false },
    };
  }

  const ds = dsParsed.data;
  const designSystemId = typeof ds.id === "string" && ds.id ? ds.id : correlationId;

  log.info("moonchild ds_bundle success", {
    owner_id: ownerId,
    tool_name: tool.name,
    scene_id: sceneId ?? null,
    design_system_id: designSystemId,
    palette_count: ds.palette?.length ?? 0,
  });

  return {
    ok: true,
    data: {
      designSystem: ds,
      designSystemId,
      sceneId: sceneId ?? "",
      sceneName: ds.name ?? "",
      toolName: tool.name,
    },
  };
}

// ── resetDiscoveredTools (test helper) ───────────────────────────────────────────────────────────

/** Reset the session-lifetime tool cache. Only used in tests. */
export function resetDiscoveredTools(): void {
  discoveredTools = null;
}
