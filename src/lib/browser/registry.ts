// registry.ts — the single table of browser_* tools the dispatcher enumerates + invokes (prompt
// item 3). Each entry pairs the agent-facing metadata (name, description, input schema) with its
// handler. BROWSER_CONNECTOR is the connector id the Mission Control approval route dispatches an
// approved browser_action_approval through (registry.ts in lib/connectors wires it to executeBrowserAction).

import type { Page } from "playwright-core";
import {
  browserNavigate,
  browserScreenshot,
  browserReadPage,
  browserClick,
  browserType,
  browserExtractTable,
  browserWaitFor,
} from "./tools";
import {
  BROWSER_TOOL_SCHEMAS,
  type BrowserToolName,
  type ToolOutput,
} from "./types";

export const BROWSER_CONNECTOR = "browser";

/** A handler runs against an already-launched, isolated Page. */
type ToolHandler = (page: Page, input: never) => Promise<ToolOutput>;

export type BrowserToolDefinition = {
  name: BrowserToolName;
  description: string;
  /** The zod schema for this tool's input (validated before the browser is ever launched). */
  schema: (typeof BROWSER_TOOL_SCHEMAS)[BrowserToolName];
  handler: ToolHandler;
};

export const BROWSER_TOOLS: Readonly<Record<BrowserToolName, BrowserToolDefinition>> = {
  browser_navigate: {
    name: "browser_navigate",
    description:
      "Open a URL in a fresh isolated headless browser and report the final URL, HTTP status, and page title.",
    schema: BROWSER_TOOL_SCHEMAS.browser_navigate,
    handler: browserNavigate as ToolHandler,
  },
  browser_screenshot: {
    name: "browser_screenshot",
    description:
      "Navigate to a URL and capture a PNG screenshot (viewport by default, fullPage:true for the whole page).",
    schema: BROWSER_TOOL_SCHEMAS.browser_screenshot,
    handler: browserScreenshot as ToolHandler,
  },
  browser_read_page: {
    name: "browser_read_page",
    description: "Navigate to a URL and return the page's readable text content (rendered innerText).",
    schema: BROWSER_TOOL_SCHEMAS.browser_read_page,
    handler: browserReadPage as ToolHandler,
  },
  browser_click: {
    name: "browser_click",
    description: "Navigate to a URL and click the element matching a CSS selector.",
    schema: BROWSER_TOOL_SCHEMAS.browser_click,
    handler: browserClick as ToolHandler,
  },
  browser_type: {
    name: "browser_type",
    description: "Navigate to a URL and type text into the input matching a CSS selector.",
    schema: BROWSER_TOOL_SCHEMAS.browser_type,
    handler: browserType as ToolHandler,
  },
  browser_extract_table: {
    name: "browser_extract_table",
    description:
      "Navigate to a URL and extract an HTML table (first <table>, or a CSS selector) as structured headers + rows.",
    schema: BROWSER_TOOL_SCHEMAS.browser_extract_table,
    handler: browserExtractTable as ToolHandler,
  },
  browser_wait_for: {
    name: "browser_wait_for",
    description: "Navigate to a URL and wait (up to a timeout) for an element matching a CSS selector to appear.",
    schema: BROWSER_TOOL_SCHEMAS.browser_wait_for,
    handler: browserWaitFor as ToolHandler,
  },
};

/** Enumerable list for the dispatcher's tool catalog. */
export function listBrowserTools(): BrowserToolDefinition[] {
  return Object.values(BROWSER_TOOLS);
}
