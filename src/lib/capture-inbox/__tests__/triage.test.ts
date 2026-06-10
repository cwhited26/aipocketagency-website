// Unit tests for the triage classifier (lib/capture-inbox/triage classifyTriageBucket) — the cheap
// Haiku call that sorts an unfiled inbox entry into one of the six buckets. The classifier reuses the
// YouTube classifier's degrade-never-throw contract: each bucket word is parsed back, an unrecognized
// word and any API failure fall to "unsure", and no key short-circuits to "unsure" without a call.
// Anthropic runs against a mocked global fetch so no network is touched.

import { afterEach, describe, expect, it, vi } from "vitest";
import type { InboxEntry } from "@/lib/pa-inbox";
import { TRIAGE_BUCKETS } from "../types";
import { classifyTriageBucket, suggestedTargetPath } from "../triage";

afterEach(() => vi.restoreAllMocks());

function entry(over: Partial<InboxEntry> = {}): InboxEntry {
  return {
    id: over.id ?? "e1",
    ts: over.ts ?? "2026-06-09T12:00:00.000Z",
    kind: over.kind ?? "note",
    content: over.content ?? "some captured text",
    ...(over.title ? { title: over.title } : {}),
    ...(over.sourceUrl ? { sourceUrl: over.sourceUrl } : {}),
  };
}

function mockAnthropic(word: string, status = 200): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify({ content: [{ type: "text", text: word }], usage: {} }), { status }),
    ),
  );
}

describe("classifyTriageBucket", () => {
  it("parses each of the six buckets back from the model", async () => {
    for (const bucket of TRIAGE_BUCKETS) {
      mockAnthropic(bucket);
      const got = await classifyTriageBucket({ apiKey: "k", entry: entry() });
      expect(got).toBe(bucket);
    }
  });

  it("tolerates surrounding punctuation/whitespace in the reply", async () => {
    mockAnthropic("  Competitive.\n");
    expect(await classifyTriageBucket({ apiKey: "k", entry: entry() })).toBe("competitive");
  });

  it("falls to 'unsure' on an unrecognized word", async () => {
    mockAnthropic("banana");
    expect(await classifyTriageBucket({ apiKey: "k", entry: entry() })).toBe("unsure");
  });

  it("falls to 'unsure' on an API error", async () => {
    mockAnthropic("competitive", 500);
    expect(await classifyTriageBucket({ apiKey: "k", entry: entry() })).toBe("unsure");
  });

  it("short-circuits to 'unsure' with no API key and never calls fetch", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(await classifyTriageBucket({ apiKey: null, entry: entry() })).toBe("unsure");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("suggestedTargetPath", () => {
  it("builds <bucket-dir>/<date>-<slug>.md from the entry", () => {
    const path = suggestedTargetPath("competitive", entry({ title: "RoofClaw new pricing", ts: "2026-06-09T00:00:00.000Z" }));
    expect(path).toBe("brain/competitive/2026-06-09-roofclaw-new-pricing.md");
  });

  it("routes 'unsure' to a neutral notes folder", () => {
    expect(suggestedTargetPath("unsure", entry({ title: "misc" }))).toMatch(/^brain\/notes\//);
  });
});
