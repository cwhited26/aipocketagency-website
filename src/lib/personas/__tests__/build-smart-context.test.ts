// build-smart-context.test.ts — the smart conversation-context blender (PA-CTX-3).

import { describe, expect, it, vi } from "vitest";
import { buildSmartContext, type ContextMessage } from "@/lib/personas/build-smart-context";

function convo(n: number): ContextMessage[] {
  return Array.from({ length: n }, (_, i) => ({
    role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
    content: `message number ${i}`,
  }));
}

describe("buildSmartContext", () => {
  it("keeps the last recentN messages verbatim and leaves older for blending", async () => {
    const ctx = await buildSmartContext(convo(10), "anything", { recentN: 4, maxRanges: 0, topK: 0 });
    expect(ctx.recentMessages).toHaveLength(4);
    expect(ctx.recentMessages.map((m) => m.content)).toEqual([
      "message number 6",
      "message number 7",
      "message number 8",
      "message number 9",
    ]);
    expect(ctx.stats.recentCount).toBe(4);
    expect(ctx.stats.olderCount).toBe(6);
  });

  it("uses an injected summarizer for older ranges and counts them", async () => {
    const summarize = vi.fn(async () => "SUMMARY");
    const ctx = await buildSmartContext(convo(12), "anything", {
      recentN: 4,
      rangeSize: 4,
      maxRanges: 4,
      topK: 0,
      summarize,
    });
    // 12 total, 4 recent → 8 older → two ranges of 4.
    expect(summarize).toHaveBeenCalledTimes(2);
    expect(ctx.stats.summaryRanges).toBe(2);
    expect(ctx.promptBlock).toContain("## Earlier in this conversation");
    expect(ctx.promptBlock).toContain("SUMMARY");
  });

  it("falls back to the extractive digest when the summarizer throws (no silent loss)", async () => {
    const summarize = vi.fn(async () => {
      throw new Error("model down");
    });
    const ctx = await buildSmartContext(convo(8), "anything", {
      recentN: 4,
      rangeSize: 4,
      maxRanges: 4,
      topK: 0,
      summarize,
    });
    expect(ctx.stats.summaryRanges).toBe(1);
    // Extractive fallback embeds the actual message text.
    expect(ctx.promptBlock).toContain("message number 0");
  });

  it("omits ranges beyond maxRanges and reports the omitted count", async () => {
    // 24 total, 4 recent → 20 older → 5 ranges of 4, capped at 2 → 3 ranges (12 msgs) omitted.
    const ctx = await buildSmartContext(convo(24), "anything", {
      recentN: 4,
      rangeSize: 4,
      maxRanges: 2,
      topK: 0,
    });
    expect(ctx.stats.summaryRanges).toBe(2);
    expect(ctx.stats.omittedOlder).toBe(12);
  });

  it("surfaces the top-K lexically relevant older messages in original order", async () => {
    const messages: ContextMessage[] = [
      { role: "user", content: "the quarterly refund policy changed last week" },
      { role: "assistant", content: "weather is nice today" },
      { role: "user", content: "what is the refund window now" },
      { role: "assistant", content: "lunch plans for friday" },
      // recent (won't be in 'older'):
      { role: "user", content: "recent one" },
      { role: "assistant", content: "recent two" },
    ];
    const ctx = await buildSmartContext(messages, "refund policy window", {
      recentN: 2,
      maxRanges: 0,
      topK: 2,
    });
    expect(ctx.stats.relevantCount).toBe(2);
    const rel = ctx.promptBlock;
    expect(rel).toContain("## Relevant earlier messages");
    expect(rel).toContain("refund policy changed");
    expect(rel).toContain("refund window now");
    expect(rel).not.toContain("weather is nice");
  });

  it("includes the daily-logs block in promptBlock and the composed block", async () => {
    const ctx = await buildSmartContext(convo(2), "q", {
      recentN: 2,
      dailyLogsBlock: "## Recent activity\nshipped the thing",
    });
    expect(ctx.promptBlock).toContain("## Recent activity");
    expect(ctx.block).toContain("## Recent activity");
    expect(ctx.stats.dailyLogsIncluded).toBe(true);
  });

  it("produces an empty promptBlock when there is nothing older and no logs", async () => {
    const ctx = await buildSmartContext(convo(2), "q", { recentN: 8 });
    expect(ctx.promptBlock).toBe("");
    expect(ctx.recentMessages).toHaveLength(2);
    expect(ctx.stats.dailyLogsIncluded).toBe(false);
  });

  it("is deterministic with the default extractive summarizer + Jaccard scorer", async () => {
    const a = await buildSmartContext(convo(20), "message number 3", { recentN: 4, rangeSize: 4, maxRanges: 2, topK: 2 });
    const b = await buildSmartContext(convo(20), "message number 3", { recentN: 4, rangeSize: 4, maxRanges: 2, topK: 2 });
    expect(a.block).toBe(b.block);
    expect(a.stats).toEqual(b.stats);
  });

  it("filters non user/assistant turns out of the window", async () => {
    const messages = [
      { role: "user", content: "u1" },
      { role: "system", content: "ignored" } as unknown as ContextMessage,
      { role: "assistant", content: "a1" },
    ];
    const ctx = await buildSmartContext(messages, "q", { recentN: 8 });
    expect(ctx.stats.totalMessages).toBe(2);
    expect(ctx.recentMessages.map((m) => m.content)).toEqual(["u1", "a1"]);
  });
});
