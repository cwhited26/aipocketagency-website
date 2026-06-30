// Tests for the Telegram document parser (PA-CHAN-1): text/code/CSV decode, the size/empty guards,
// and the unsupported-binary path. PDF extraction goes through the lazy pdf-parse import and is
// exercised at runtime, not here (no fixture binary in the unit suite).

import { describe, expect, it } from "vitest";
import { parseDocument, MAX_DOCUMENT_TEXT_CHARS } from "../documents";

describe("parseDocument", () => {
  it("decodes a CSV as text (no csv-parse dependency needed)", async () => {
    const csv = "name,amount\nAcme,1200\nGlobex,980\n";
    const res = await parseDocument({
      buffer: Buffer.from(csv, "utf8"),
      fileName: "invoices.csv",
      mimeType: "text/csv",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("expected ok");
    expect(res.text).toContain("Acme,1200");
    expect(res.truncated).toBe(false);
  });

  it("decodes a code file by extension even without a mime type", async () => {
    const res = await parseDocument({
      buffer: Buffer.from("export const x = 1;\n", "utf8"),
      fileName: "snippet.ts",
      mimeType: null,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("expected ok");
    expect(res.text).toContain("export const x = 1;");
  });

  it("truncates text past the char cap and flags it", async () => {
    const big = "x".repeat(MAX_DOCUMENT_TEXT_CHARS + 500);
    const res = await parseDocument({ buffer: Buffer.from(big, "utf8"), fileName: "big.txt", mimeType: "text/plain" });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("expected ok");
    expect(res.text.length).toBe(MAX_DOCUMENT_TEXT_CHARS);
    expect(res.truncated).toBe(true);
  });

  it("reports an empty file rather than returning empty text", async () => {
    const res = await parseDocument({ buffer: Buffer.from("", "utf8"), fileName: "empty.txt", mimeType: "text/plain" });
    expect(res).toEqual({ ok: false, reason: "empty_file" });
  });

  it("reports an unsupported binary type instead of guessing", async () => {
    const res = await parseDocument({
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      fileName: "photo.png",
      mimeType: "image/png",
    });
    expect(res).toEqual({ ok: false, reason: "unsupported_type" });
  });
});
