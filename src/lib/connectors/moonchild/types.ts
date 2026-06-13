// connectors/moonchild/types.ts — Zod schemas + domain types for the Moonchild MCP connector.
// Moonchild publishes an HTTP MCP server at MOONCHILD_MCP_URL. The design system it returns is
// stored on pa_landing_pages (migration 080) so code-gen never depends on Moonchild being
// reachable at build time. (PA-LPB-10)

import { z } from "zod";

// ── Config ────────────────────────────────────────────────────────────────────────────────────────

export type MoonchildConfig =
  | { configured: true; mcpUrl: string; token: string }
  | { configured: false; reason: string };

// ── MCP tool discovery ────────────────────────────────────────────────────────────────────────────

export const McpToolParamSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  required: z.boolean().optional(),
  schema: z.record(z.string(), z.unknown()).optional(),
});

export const McpToolSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  inputSchema: z
    .object({ type: z.literal("object"), properties: z.record(z.string(), z.unknown()).optional(), required: z.array(z.string()).optional() })
    .optional(),
});

export type McpTool = z.infer<typeof McpToolSchema>;

export const McpToolsListResponseSchema = z.object({
  tools: z.array(McpToolSchema),
  nextCursor: z.string().optional(),
});

export type McpToolsListResponse = z.infer<typeof McpToolsListResponseSchema>;

// ── Design system ─────────────────────────────────────────────────────────────────────────────────

export const PaletteEntrySchema = z.object({
  name: z.string().optional(),
  hex: z
    .string()
    .regex(/^#[0-9a-fA-F]{3,8}$/)
    .optional(),
  role: z.string().optional(),
});

export type PaletteEntry = z.infer<typeof PaletteEntrySchema>;

export const TypographyScaleSchema = z.object({
  family: z.string().optional(),
  weight: z.union([z.string(), z.number()]).optional(),
  size: z.string().optional(),
});

export type TypographyScale = z.infer<typeof TypographyScaleSchema>;

// The Moonchild server may return extra fields or wrong types for optional fields when the server
// version changes. Using .catch(undefined) on each optional field makes the schema maximally
// tolerant: wrong types are silently stripped rather than failing the whole parse. (PA-LPB-11)
export const DesignSystemSchema = z.object({
  id: z.string().optional().catch(undefined),
  name: z.string().optional().catch(undefined),
  source_url: z.string().optional().catch(undefined),
  palette: z.array(PaletteEntrySchema).optional().catch(undefined),
  typography: z
    .object({
      heading: TypographyScaleSchema.optional().catch(undefined),
      body: TypographyScaleSchema.optional().catch(undefined),
      mono: TypographyScaleSchema.optional().catch(undefined),
    })
    .optional()
    .catch(undefined),
  components: z.record(z.string(), z.string()).optional().catch(undefined),
  raw: z.unknown().optional(),
  exported_at: z.string().optional().catch(undefined),
});

export type DesignSystem = z.infer<typeof DesignSystemSchema>;

// ── Result union ──────────────────────────────────────────────────────────────────────────────────

export type ConnectorError = {
  kind: "not_configured" | "network" | "auth" | "rate_limit" | "invalid_response" | "tool_not_found";
  message: string;
  retryable: boolean;
};

export type ConnectorResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ConnectorError };

// ── Import-DS call result ─────────────────────────────────────────────────────────────────────────

export type ImportDesignSystemResult = {
  designSystem: DesignSystem;
  /** Opaque Moonchild reference (the tool's returned id, or the correlation id as fallback). */
  designSystemId: string;
  /** The tool name that was actually called — logged for diagnostics (PA-LPB-11). */
  toolName: string;
};
