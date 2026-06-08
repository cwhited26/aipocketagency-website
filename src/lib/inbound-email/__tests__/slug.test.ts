import { describe, it, expect } from "vitest";
import { slugifyLocalPart, slugifyForPath, localPartWithSuffix } from "../slug";
import { bccBrainPath } from "../handle-bcc";

describe("slugifyLocalPart", () => {
  it("lowercases and hyphenates", () => {
    expect(slugifyLocalPart("Alan Stoll")).toBe("alan-stoll");
  });
  it("collapses runs and trims hyphens", () => {
    expect(slugifyLocalPart("  Foo --  Bar!! ")).toBe("foo-bar");
  });
  it("returns empty for an all-symbol name", () => {
    expect(slugifyLocalPart("✨🚀")).toBe("");
  });
  it("bounds the length", () => {
    expect(slugifyLocalPart("a".repeat(100)).length).toBe(40);
  });
});

describe("slugifyForPath", () => {
  it("falls back when nothing usable survives", () => {
    expect(slugifyForPath("", "no-subject")).toBe("no-subject");
    expect(slugifyForPath("✨", "fallback")).toBe("fallback");
  });
});

describe("localPartWithSuffix", () => {
  it("appends a suffix", () => {
    expect(localPartWithSuffix("chase", "a1b2")).toBe("chase-a1b2");
  });
});

describe("bccBrainPath", () => {
  it("builds a dated, slugged brain path", () => {
    const path = bccBrainPath("client@acme.com", "Re: Proposal v2", "2026-06-08T12:00:00.000Z");
    expect(path).toBe("brain/email-log/2026-06-08/client-re-proposal-v2.md");
  });
});
