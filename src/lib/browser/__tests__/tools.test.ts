import { describe, it, expect, vi } from "vitest";
import type { Page } from "playwright-core";
import {
  browserNavigate,
  browserScreenshot,
  browserReadPage,
  browserClick,
  browserType,
  browserExtractTable,
  browserWaitFor,
} from "../tools";

// A minimal fake Page: every method each handler touches is a vi.fn with a sensible default. Tests
// override per case. This lets us assert the exact Playwright calls + the shaped output with no real
// Chromium (prompt: "each tool handler with mocked Playwright").
function fakePage(overrides: Partial<Record<keyof Page, unknown>> = {}): Page {
  const page = {
    goto: vi.fn().mockResolvedValue({ status: () => 200 }),
    waitForLoadState: vi.fn().mockResolvedValue(undefined),
    title: vi.fn().mockResolvedValue("Example Title"),
    url: vi.fn().mockReturnValue("https://example.com/final"),
    evaluate: vi.fn().mockResolvedValue(""),
    screenshot: vi.fn().mockResolvedValue(Buffer.from("PNGBYTES")),
    click: vi.fn().mockResolvedValue(undefined),
    fill: vi.fn().mockResolvedValue(undefined),
    waitForSelector: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return page as unknown as Page;
}

describe("browserNavigate", () => {
  it("navigates and reports status, final URL, and title", async () => {
    const page = fakePage();
    const out = await browserNavigate(page, { url: "https://example.com" });
    expect(page.goto).toHaveBeenCalledWith("https://example.com", expect.objectContaining({ waitUntil: "domcontentloaded" }));
    expect(out.data).toMatchObject({ status: 200, finalUrl: "https://example.com/final", title: "Example Title" });
    expect(out.summary).toContain("HTTP 200");
  });
});

describe("browserScreenshot", () => {
  it("captures a viewport PNG and returns base64", async () => {
    const page = fakePage();
    const out = await browserScreenshot(page, { url: "https://example.com" });
    expect(page.screenshot).toHaveBeenCalledWith(expect.objectContaining({ fullPage: false, type: "png" }));
    expect(out.screenshotBase64).toBe(Buffer.from("PNGBYTES").toString("base64"));
    expect(out.data).toMatchObject({ fullPage: false });
  });

  it("honors fullPage:true", async () => {
    const page = fakePage();
    await browserScreenshot(page, { url: "https://example.com", fullPage: true });
    expect(page.screenshot).toHaveBeenCalledWith(expect.objectContaining({ fullPage: true }));
  });
});

describe("browserReadPage", () => {
  it("returns whitespace-collapsed readable text", async () => {
    const page = fakePage({ evaluate: vi.fn().mockResolvedValue("Hello\n\n\n\nworld   \n") });
    const out = await browserReadPage(page, { url: "https://example.com" });
    expect(out.data.text).toBe("Hello\n\nworld");
    expect(out.data.truncated).toBe(false);
  });

  it("truncates very long content", async () => {
    const page = fakePage({ evaluate: vi.fn().mockResolvedValue("x".repeat(50_000)) });
    const out = await browserReadPage(page, { url: "https://example.com" });
    expect(out.data.truncated).toBe(true);
    expect((out.data.text as string).length).toBe(40_000);
  });
});

describe("browserClick", () => {
  it("clicks the selector and reports the resulting URL", async () => {
    const page = fakePage({ url: vi.fn().mockReturnValueOnce("https://example.com").mockReturnValue("https://example.com/next") });
    const out = await browserClick(page, { url: "https://example.com", selector: "button.go" });
    expect(page.click).toHaveBeenCalledWith("button.go", expect.objectContaining({ timeout: 10_000 }));
    expect(out.data).toMatchObject({ selector: "button.go" });
  });
});

describe("browserType", () => {
  it("fills the input and reports the char count", async () => {
    const page = fakePage();
    const out = await browserType(page, { url: "https://example.com", selector: "#q", text: "hello" });
    expect(page.fill).toHaveBeenCalledWith("#q", "hello", expect.objectContaining({ timeout: 10_000 }));
    expect(out.data).toMatchObject({ selector: "#q", charCount: 5 });
  });
});

describe("browserExtractTable", () => {
  it("returns headers + rows from the extracted table", async () => {
    const table = { headers: ["Name", "Age"], rows: [["Ada", "36"]], rowCount: 1, colCount: 2 };
    const page = fakePage({ evaluate: vi.fn().mockResolvedValue(table) });
    const out = await browserExtractTable(page, { url: "https://example.com" });
    expect(out.data).toMatchObject({ headers: ["Name", "Age"], rowCount: 1, colCount: 2 });
  });

  it("throws when no table matches", async () => {
    const page = fakePage({ evaluate: vi.fn().mockResolvedValue(null) });
    await expect(browserExtractTable(page, { url: "https://example.com", selector: "#nope" })).rejects.toThrow(/No table matched/);
  });
});

describe("browserWaitFor", () => {
  it("waits for the visible selector", async () => {
    const page = fakePage();
    const out = await browserWaitFor(page, { url: "https://example.com", selector: ".ready" });
    expect(page.waitForSelector).toHaveBeenCalledWith(".ready", expect.objectContaining({ state: "visible" }));
    expect(out.data).toMatchObject({ selector: ".ready" });
  });

  it("propagates a wait timeout error", async () => {
    const page = fakePage({ waitForSelector: vi.fn().mockRejectedValue(new Error("Timeout 15000ms exceeded")) });
    await expect(browserWaitFor(page, { url: "https://example.com", selector: ".never" })).rejects.toThrow(/Timeout/);
  });
});
