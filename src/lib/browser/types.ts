// types.ts — the shared shapes for the Browser Automation tool catalog.

import { z } from "zod";

/** The seven Phase-1 tools. Names are the agent-facing tool identifiers + the action column value. */
export const BROWSER_TOOL_NAMES = [
  "browser_navigate",
  "browser_screenshot",
  "browser_read_page",
  "browser_click",
  "browser_type",
  "browser_extract_table",
  "browser_wait_for",
] as const;

export type BrowserToolName = (typeof BROWSER_TOOL_NAMES)[number];

export function isBrowserToolName(value: string): value is BrowserToolName {
  return (BROWSER_TOOL_NAMES as readonly string[]).includes(value);
}

// ── Per-tool input schemas ──────────────────────────────────────────────────────────────────────────
// Every tool acts on a fresh, isolated browser (Basic mode), so each call carries its own `url` to
// navigate to first — there is no persistent tab between calls. Selectors are CSS.

const urlField = z.string().url("must be an absolute http(s) URL");

export const BROWSER_TOOL_SCHEMAS = {
  browser_navigate: z.object({
    url: urlField,
  }),
  browser_screenshot: z.object({
    url: urlField,
    fullPage: z.boolean().optional(),
  }),
  browser_read_page: z.object({
    url: urlField,
  }),
  browser_click: z.object({
    url: urlField,
    selector: z.string().min(1, "selector is required"),
  }),
  browser_type: z.object({
    url: urlField,
    selector: z.string().min(1, "selector is required"),
    text: z.string(),
  }),
  browser_extract_table: z.object({
    url: urlField,
    selector: z.string().min(1).optional(),
  }),
  browser_wait_for: z.object({
    url: urlField,
    selector: z.string().min(1, "selector is required"),
    timeoutMs: z.number().int().positive().max(30_000).optional(),
  }),
} as const satisfies Record<BrowserToolName, z.ZodTypeAny>;

export type BrowserToolInput<T extends BrowserToolName> = z.infer<(typeof BROWSER_TOOL_SCHEMAS)[T]>;

/** What every tool handler returns. `screenshotBase64`, when set, is uploaded to Storage by the caller. */
export type ToolOutput = {
  /** One-line human summary rendered on the approval card + the log row. */
  summary: string;
  /** Structured result persisted to pa_browser_actions.result_json. */
  data: Record<string, unknown>;
  /** Raw PNG base64 (no data: prefix) when the tool captured a screenshot. */
  screenshotBase64?: string;
};
