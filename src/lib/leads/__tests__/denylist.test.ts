import { describe, it, expect } from "vitest";
import { screenUrl, screenUrlList, domainOf } from "../denylist";

describe("screenUrl", () => {
  it("accepts a normal public URL", () => {
    const r = screenUrl("https://example-roofing.com/about");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.domain).toBe("example-roofing.com");
  });

  it("strips a leading www from the domain", () => {
    const r = screenUrl("https://www.example.com");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.domain).toBe("example.com");
  });

  it.each(["/admin", "/login", "/internal", "/account", "/dashboard"])(
    "rejects a %s path",
    (path) => {
      const r = screenUrl(`https://example.com${path}`);
      expect(r.ok).toBe(false);
    },
  );

  it("rejects denylisted paths case-insensitively and on sub-paths", () => {
    expect(screenUrl("https://example.com/Admin/users").ok).toBe(false);
    expect(screenUrl("https://example.com/app/dashboard/v2").ok).toBe(false);
  });

  it("rejects a malformed URL", () => {
    expect(screenUrl("not a url").ok).toBe(false);
  });

  it("rejects a non-http(s) protocol", () => {
    expect(screenUrl("ftp://example.com/file").ok).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(screenUrl("   ").ok).toBe(false);
  });
});

describe("screenUrlList", () => {
  it("splits clean from rejected and de-dups exact repeats", () => {
    const { ok, rejected } = screenUrlList([
      "https://a.com",
      "https://a.com",
      "https://b.com/login",
      "garbage",
    ]);
    expect(ok.map((o) => o.url)).toEqual(["https://a.com"]);
    expect(rejected).toHaveLength(2);
  });
});

describe("domainOf", () => {
  it("returns empty string for an unparseable URL", () => {
    expect(domainOf("nope")).toBe("");
  });
});
