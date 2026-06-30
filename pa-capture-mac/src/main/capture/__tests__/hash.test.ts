import { describe, it, expect } from "vitest";
import { computeContentHash, isDuplicateHash } from "../hash";

describe("computeContentHash", () => {
  it("is a stable 64-char hex SHA-256", () => {
    const h = computeContentHash({ kind: "text", content: "hello" });
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(computeContentHash({ kind: "text", content: "hello" })).toBe(h);
  });

  it("differs when content differs", () => {
    expect(computeContentHash({ kind: "text", content: "a" })).not.toBe(
      computeContentHash({ kind: "text", content: "b" }),
    );
  });

  it("differs when kind differs for identical content", () => {
    expect(computeContentHash({ kind: "text", content: "https://x.com" })).not.toBe(
      computeContentHash({ kind: "url", content: "https://x.com" }),
    );
  });

  it("differs when filename differs for identical bytes", () => {
    expect(computeContentHash({ kind: "image", content: "Zm9v", filename: "a.png" })).not.toBe(
      computeContentHash({ kind: "image", content: "Zm9v", filename: "b.png" }),
    );
  });

  it("treats null and undefined filename the same", () => {
    expect(computeContentHash({ kind: "text", content: "x", filename: null })).toBe(
      computeContentHash({ kind: "text", content: "x", filename: undefined }),
    );
  });

  it("does not collide across the field boundary (separator is unambiguous)", () => {
    // Without a separator, ("ab","") and ("a","b") would hash the same. With one they don't.
    expect(computeContentHash({ kind: "text", content: "ab", filename: "" })).not.toBe(
      computeContentHash({ kind: "text", content: "a", filename: "b" }),
    );
  });
});

describe("isDuplicateHash", () => {
  it("reports membership in the seen set", () => {
    const seen = new Set<string>(["abc"]);
    expect(isDuplicateHash("abc", seen)).toBe(true);
    expect(isDuplicateHash("xyz", seen)).toBe(false);
  });
});
