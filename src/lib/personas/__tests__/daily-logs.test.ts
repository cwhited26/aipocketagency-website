// daily-logs.test.ts — pure formatter coverage for the daily activity log (PA-CTX-1).
// The REST read/write paths are integration-tested elsewhere; here we pin the deterministic shaping.

import { describe, expect, it } from "vitest";
import {
  appendLineToContent,
  DailyLogEntrySchema,
  formatDailyLogsBlock,
  formatLogLine,
  utcDateKey,
  type DailyLogRow,
} from "@/lib/personas/daily-logs";

const at = (iso: string) => new Date(iso);

describe("utcDateKey / formatLogLine", () => {
  it("derives the UTC calendar date", () => {
    expect(utcDateKey(at("2026-06-27T23:59:00Z"))).toBe("2026-06-27");
  });
  it("prefixes an auto-generated HH:MM UTC stamp and trims the entry", () => {
    expect(formatLogLine("  closed the Acme deal  ", at("2026-06-27T09:05:00Z"))).toBe(
      "09:05 UTC — closed the Acme deal",
    );
  });
});

describe("appendLineToContent", () => {
  it("starts a fresh log when content is empty", () => {
    expect(appendLineToContent("", "09:05 UTC — first")).toBe("09:05 UTC — first");
  });
  it("appends with a single newline, collapsing trailing whitespace", () => {
    expect(appendLineToContent("09:05 UTC — first\n", "10:00 UTC — second")).toBe(
      "09:05 UTC — first\n10:00 UTC — second",
    );
  });
});

describe("DailyLogEntrySchema", () => {
  it("rejects empty and over-long entries", () => {
    expect(DailyLogEntrySchema.safeParse("   ").success).toBe(false);
    expect(DailyLogEntrySchema.safeParse("x".repeat(2_001)).success).toBe(false);
  });
  it("accepts and trims a normal entry", () => {
    const r = DailyLogEntrySchema.safeParse("  did a thing  ");
    expect(r.success && r.data).toBe("did a thing");
  });
});

describe("formatDailyLogsBlock", () => {
  const row = (date: string, content: string): DailyLogRow => ({
    id: date,
    owner_id: "o1",
    log_date: date,
    content,
    updated_at: `${date}T12:00:00Z`,
  });

  it("renders a ## Recent activity block with dated sub-sections (newest first)", () => {
    const block = formatDailyLogsBlock(
      [row("2026-06-27", "09:05 UTC — shipped"), row("2026-06-26", "14:00 UTC — planned")],
      3,
    );
    expect(block.startsWith("## Recent activity")).toBe(true);
    expect(block).toContain("### 2026-06-27");
    expect(block).toContain("shipped");
    expect(block).toContain("### 2026-06-26");
    expect(block.indexOf("2026-06-27")).toBeLessThan(block.indexOf("2026-06-26"));
  });

  it("returns '' when no row has content (skips an empty heading)", () => {
    expect(formatDailyLogsBlock([row("2026-06-27", "   ")], 3)).toBe("");
    expect(formatDailyLogsBlock([], 3)).toBe("");
  });

  it("caps to `days` rows", () => {
    const rows = [row("2026-06-27", "a"), row("2026-06-26", "b"), row("2026-06-25", "c")];
    const block = formatDailyLogsBlock(rows, 2);
    expect(block).toContain("### 2026-06-27");
    expect(block).toContain("### 2026-06-26");
    expect(block).not.toContain("### 2026-06-25");
  });
});
