// tools.ts — the seven Phase-1 tool handlers (prompt item 3). Each is a pure-ish async function of
// (page, input) → ToolOutput: it drives one already-launched, isolated Playwright Page and returns a
// structured result. Splitting the handlers from the pool + the gate lets every handler be unit-tested
// against a mocked Page (no real Chromium) — the test asserts the exact Playwright calls + the shaped
// output.
//
// Handlers throw on failure (bad selector, navigation error); runInPool catches + types it, and
// execute.ts records a 'failed' audit row. No silent catches here — a miss surfaces.

import type { Page } from "playwright-core";
import type { BrowserToolInput, ToolOutput } from "./types";

const READ_PAGE_MAX_CHARS = 40_000; // keep the readable-text payload bounded for the row + the LLM context
const EXTRACT_MAX_ROWS = 500;
const EXTRACT_MAX_COLS = 50;

/** Navigate + let the page settle. Shared by every tool (each call starts from a blank, isolated page). */
async function gotoAndSettle(page: Page, url: string): Promise<{ status: number; finalUrl: string; title: string }> {
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  const status = response?.status() ?? 0;
  // Best-effort network settle — long-pollers never idle, so a timeout here is fine, not fatal.
  await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => undefined);
  const title = await page.title().catch(() => "");
  return { status, finalUrl: page.url(), title };
}

export async function browserNavigate(
  page: Page,
  input: BrowserToolInput<"browser_navigate">,
): Promise<ToolOutput> {
  const nav = await gotoAndSettle(page, input.url);
  return {
    summary: `Navigated to ${nav.finalUrl} (HTTP ${nav.status})${nav.title ? ` — "${nav.title}"` : ""}`,
    data: { status: nav.status, finalUrl: nav.finalUrl, title: nav.title },
  };
}

export async function browserScreenshot(
  page: Page,
  input: BrowserToolInput<"browser_screenshot">,
): Promise<ToolOutput> {
  const nav = await gotoAndSettle(page, input.url);
  const buffer = await page.screenshot({ fullPage: input.fullPage ?? false, type: "png" });
  const screenshotBase64 = Buffer.from(buffer).toString("base64");
  return {
    summary: `Captured a ${input.fullPage ? "full-page" : "viewport"} screenshot of ${nav.finalUrl}`,
    data: { finalUrl: nav.finalUrl, title: nav.title, fullPage: input.fullPage ?? false },
    screenshotBase64,
  };
}

export async function browserReadPage(
  page: Page,
  input: BrowserToolInput<"browser_read_page">,
): Promise<ToolOutput> {
  const nav = await gotoAndSettle(page, input.url);
  // Readable text = the body's rendered innerText, whitespace-collapsed + bounded. This is the
  // accessibility/reading surface, not the raw HTML — what an agent reasons over.
  const raw = await page.evaluate(() => document.body?.innerText ?? "");
  const text = raw.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  const truncated = text.length > READ_PAGE_MAX_CHARS;
  const content = truncated ? text.slice(0, READ_PAGE_MAX_CHARS) : text;
  return {
    summary: `Read ${content.length.toLocaleString()} chars of readable text from ${nav.finalUrl}${truncated ? " (truncated)" : ""}`,
    data: { finalUrl: nav.finalUrl, title: nav.title, text: content, truncated },
  };
}

export async function browserClick(
  page: Page,
  input: BrowserToolInput<"browser_click">,
): Promise<ToolOutput> {
  const nav = await gotoAndSettle(page, input.url);
  await page.click(input.selector, { timeout: 10_000 });
  // The click may have navigated or mutated the DOM — report where we ended up.
  await page.waitForLoadState("domcontentloaded", { timeout: 8_000 }).catch(() => undefined);
  const finalUrl = page.url();
  return {
    summary: `Clicked "${input.selector}" on ${nav.finalUrl}${finalUrl !== nav.finalUrl ? ` → ${finalUrl}` : ""}`,
    data: { selector: input.selector, fromUrl: nav.finalUrl, finalUrl },
  };
}

export async function browserType(
  page: Page,
  input: BrowserToolInput<"browser_type">,
): Promise<ToolOutput> {
  const nav = await gotoAndSettle(page, input.url);
  // fill() clears + sets the value in one shot; it asserts the element is an editable input/textarea.
  await page.fill(input.selector, input.text, { timeout: 10_000 });
  return {
    summary: `Typed ${input.text.length} char(s) into "${input.selector}" on ${nav.finalUrl}`,
    data: { selector: input.selector, finalUrl: nav.finalUrl, charCount: input.text.length },
  };
}

type TableExtraction = { headers: string[]; rows: string[][]; rowCount: number; colCount: number };

export async function browserExtractTable(
  page: Page,
  input: BrowserToolInput<"browser_extract_table">,
): Promise<ToolOutput> {
  const nav = await gotoAndSettle(page, input.url);
  const selector = input.selector ?? "table";
  const extracted = (await page.evaluate(
    ({ sel, maxRows, maxCols }: { sel: string; maxRows: number; maxCols: number }) => {
      const table = document.querySelector(sel);
      if (!table) return null;
      const trs = Array.from(table.querySelectorAll("tr")).slice(0, maxRows + 1);
      const cellsOf = (tr: Element): string[] =>
        Array.from(tr.querySelectorAll("th,td"))
          .slice(0, maxCols)
          .map((c) => (c.textContent ?? "").replace(/\s+/g, " ").trim());
      if (trs.length === 0) return { headers: [], rows: [], rowCount: 0, colCount: 0 };
      // First row is treated as headers iff it contains any <th>; otherwise it's a data row.
      const firstHasTh = trs[0].querySelector("th") !== null;
      const headers = firstHasTh ? cellsOf(trs[0]) : [];
      const dataRows = (firstHasTh ? trs.slice(1) : trs).map(cellsOf);
      const colCount = Math.max(headers.length, ...dataRows.map((r) => r.length), 0);
      return { headers, rows: dataRows, rowCount: dataRows.length, colCount };
    },
    { sel: selector, maxRows: EXTRACT_MAX_ROWS, maxCols: EXTRACT_MAX_COLS },
  )) as TableExtraction | null;

  if (!extracted) {
    throw new Error(`No table matched selector "${selector}" on ${nav.finalUrl}`);
  }
  return {
    summary: `Extracted a ${extracted.rowCount}×${extracted.colCount} table ("${selector}") from ${nav.finalUrl}`,
    data: {
      finalUrl: nav.finalUrl,
      selector,
      headers: extracted.headers,
      rows: extracted.rows,
      rowCount: extracted.rowCount,
      colCount: extracted.colCount,
    },
  };
}

export async function browserWaitFor(
  page: Page,
  input: BrowserToolInput<"browser_wait_for">,
): Promise<ToolOutput> {
  const nav = await gotoAndSettle(page, input.url);
  const timeout = input.timeoutMs ?? 15_000;
  await page.waitForSelector(input.selector, { timeout, state: "visible" });
  return {
    summary: `"${input.selector}" appeared on ${nav.finalUrl} within ${Math.round(timeout / 1000)}s`,
    data: { selector: input.selector, finalUrl: nav.finalUrl, timeoutMs: timeout },
  };
}
