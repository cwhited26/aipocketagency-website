import { describe, expect, it } from "vitest";
import type { InboxEntry } from "@/lib/pa-inbox";
import {
  iconForSource,
  previewOf,
  toFeedItem,
  recentFeedItems,
  shouldStopPolling,
} from "../feed";

function entry(over: Partial<InboxEntry> = {}): InboxEntry {
  return {
    id: over.id ?? "e1",
    ts: over.ts ?? "2026-06-23T10:00:00.000Z",
    kind: over.kind ?? "text",
    content: over.content ?? "hello world",
    ...(over.title ? { title: over.title } : {}),
    ...(over.source ? { source: over.source } : {}),
  };
}

describe("iconForSource", () => {
  it("maps known capture surfaces to icons", () => {
    expect(iconForSource("email_forward")).toBe("✉️");
    expect(iconForSource("sms")).toBe("📱");
    expect(iconForSource("share_sheet")).toBe("🔗");
    expect(iconForSource("ios_shortcut")).toBe("🎤");
  });
  it("falls back to a default for unknown/absent sources", () => {
    expect(iconForSource(undefined)).toBe("📝");
    expect(iconForSource(null)).toBe("📝");
    expect(iconForSource("mystery")).toBe("📝");
  });
});

describe("previewOf", () => {
  it("collapses whitespace to a single line", () => {
    expect(previewOf("a\n\n  b   c")).toBe("a b c");
  });
  it("clamps long bodies with an ellipsis", () => {
    const long = "x".repeat(200);
    const out = previewOf(long, 50);
    expect(out.length).toBe(50);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("toFeedItem", () => {
  it("maps an inbox entry, prefixing the title into the preview", () => {
    const item = toFeedItem(entry({ title: "Idea", content: "build it", source: "sms" }));
    expect(item.icon).toBe("📱");
    expect(item.title).toBe("Idea");
    expect(item.preview).toContain("Idea");
    expect(item.preview).toContain("build it");
  });
});

describe("recentFeedItems", () => {
  it("takes the newest N (entries arrive newest-first)", () => {
    const entries = [entry({ id: "a" }), entry({ id: "b" }), entry({ id: "c" })];
    expect(recentFeedItems(entries, 2).map((i) => i.id)).toEqual(["a", "b"]);
  });
  it("clamps a non-positive limit to nothing", () => {
    expect(recentFeedItems([entry()], 0)).toEqual([]);
  });
});

describe("shouldStopPolling", () => {
  it("keeps polling while no capture has landed", () => {
    expect(shouldStopPolling([])).toBe(false);
  });
  it("stops the moment the first capture lands", () => {
    expect(shouldStopPolling([toFeedItem(entry())])).toBe(true);
  });
});
