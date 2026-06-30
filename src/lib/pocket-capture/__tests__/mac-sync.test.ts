import { describe, it, expect } from "vitest";
import {
  MacCaptureItemSchema,
  MacSyncBodySchema,
  MAX_BATCH_ITEMS,
  buildMacCaptureEntry,
  macBinaryName,
  macProvenanceLine,
  MAC_CAPTURE_SOURCE,
  type MacCaptureItem,
} from "../mac-sync";

const HASH = "a".repeat(64);
const WHEN = "2026-06-30T12:00:00.000Z";

function textItem(overrides: Partial<MacCaptureItem> = {}): Record<string, unknown> {
  return { kind: "text", content: "hello", sourceApp: "Safari", capturedAt: WHEN, hash: HASH, ...overrides };
}

describe("MacCaptureItemSchema", () => {
  it("accepts a well-formed text item", () => {
    const parsed = MacCaptureItemSchema.safeParse(textItem());
    expect(parsed.success).toBe(true);
  });

  it("accepts a url item", () => {
    expect(
      MacCaptureItemSchema.safeParse(textItem({ kind: "url", content: "https://x.com" })).success,
    ).toBe(true);
  });

  it("rejects an unknown kind", () => {
    expect(MacCaptureItemSchema.safeParse(textItem({ kind: "audio" })).success).toBe(false);
  });

  it("rejects empty content", () => {
    expect(MacCaptureItemSchema.safeParse(textItem({ content: "" })).success).toBe(false);
  });

  it("rejects a hash that is not 64-char lowercase hex", () => {
    expect(MacCaptureItemSchema.safeParse(textItem({ hash: "XYZ" })).success).toBe(false);
    expect(MacCaptureItemSchema.safeParse(textItem({ hash: "A".repeat(64) })).success).toBe(false);
    expect(MacCaptureItemSchema.safeParse(textItem({ hash: "a".repeat(63) })).success).toBe(false);
  });

  it("rejects a non-ISO capturedAt", () => {
    expect(MacCaptureItemSchema.safeParse(textItem({ capturedAt: "yesterday" })).success).toBe(false);
  });

  it("requires a filename for image/file kinds", () => {
    const noName = MacCaptureItemSchema.safeParse(
      textItem({ kind: "image", content: "Zm9v", filename: null }),
    );
    expect(noName.success).toBe(false);
    const withName = MacCaptureItemSchema.safeParse(
      textItem({ kind: "image", content: "Zm9v", filename: "shot.png", mimeType: "image/png" }),
    );
    expect(withName.success).toBe(true);
  });

  it("allows null sourceApp", () => {
    expect(MacCaptureItemSchema.safeParse(textItem({ sourceApp: null })).success).toBe(true);
  });
});

describe("MacSyncBodySchema", () => {
  it("requires a non-empty items array", () => {
    expect(MacSyncBodySchema.safeParse({ items: [] }).success).toBe(false);
  });

  it("accepts a batch of items", () => {
    expect(MacSyncBodySchema.safeParse({ items: [textItem()] }).success).toBe(true);
  });

  it("rejects a batch larger than the cap", () => {
    const items = Array.from({ length: MAX_BATCH_ITEMS + 1 }, () => textItem());
    expect(MacSyncBodySchema.safeParse({ items }).success).toBe(false);
  });
});

describe("macProvenanceLine", () => {
  it("names the source app when known", () => {
    expect(macProvenanceLine("Safari")).toBe("— Captured from Safari via Mac Capture");
  });
  it("falls back when the source app is unknown", () => {
    expect(macProvenanceLine(null)).toBe("— Captured via Mac Capture");
    expect(macProvenanceLine("  ")).toBe("— Captured via Mac Capture");
  });
});

describe("macBinaryName", () => {
  it("strips path components from a filename", () => {
    expect(macBinaryName({ kind: "file", filename: "/Users/x/Desktop/deck.pdf" })).toBe("deck.pdf");
  });
  it("defaults by kind when no filename", () => {
    expect(macBinaryName({ kind: "image", filename: null })).toBe("screenshot");
    expect(macBinaryName({ kind: "file", filename: undefined })).toBe("file");
  });
});

describe("buildMacCaptureEntry", () => {
  it("maps a text capture to an inbox 'text' entry with provenance", () => {
    const entry = buildMacCaptureEntry(textItem() as unknown as MacCaptureItem, null);
    expect(entry.kind).toBe("text");
    expect(entry.source).toBe(MAC_CAPTURE_SOURCE);
    expect(entry.content).toContain("hello");
    expect(entry.content).toContain("— Captured from Safari via Mac Capture");
    expect(entry.sourceUrl).toBeUndefined();
  });

  it("maps a url capture to a 'url' entry with sourceUrl set", () => {
    const item = textItem({ kind: "url", content: "https://example.com/x" }) as unknown as MacCaptureItem;
    const entry = buildMacCaptureEntry(item, null);
    expect(entry.kind).toBe("url");
    expect(entry.sourceUrl).toBe("https://example.com/x");
    expect(entry.content).toContain("https://example.com/x");
  });

  it("maps a binary capture to a 'note' referencing the stored path", () => {
    const item = textItem({
      kind: "image",
      content: "Zm9v",
      filename: "shot.png",
      mimeType: "image/png",
    }) as unknown as MacCaptureItem;
    const entry = buildMacCaptureEntry(item, "pocket-capture/owner-1/abc/shot.png");
    expect(entry.kind).toBe("note");
    expect(entry.title).toBe("shot.png");
    expect(entry.content).toContain("Stored at pocket-capture/owner-1/abc/shot.png");
  });

  it("notes when a binary was not stored", () => {
    const item = textItem({
      kind: "file",
      content: "Zm9v",
      filename: "notes.txt",
    }) as unknown as MacCaptureItem;
    const entry = buildMacCaptureEntry(item, null);
    expect(entry.content).toContain("(attachment not stored)");
  });
});
