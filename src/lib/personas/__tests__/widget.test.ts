import { describe, it, expect } from "vitest";
import {
  buildFrameAncestors,
  buildWidgetLoaderJs,
  isOriginAllowed,
  normalizeOrigin,
} from "../widget";

describe("normalizeOrigin", () => {
  it("strips path + lowercases + drops trailing slash", () => {
    expect(normalizeOrigin("https://Example.com/some/path")).toBe("https://example.com");
    expect(normalizeOrigin("https://example.com/")).toBe("https://example.com");
  });
  it("preserves an explicit port", () => {
    expect(normalizeOrigin("http://localhost:3000")).toBe("http://localhost:3000");
  });
  it("rejects the null origin and malformed values", () => {
    expect(normalizeOrigin("null")).toBeNull();
    expect(normalizeOrigin(null)).toBeNull();
    expect(normalizeOrigin("")).toBeNull();
    expect(normalizeOrigin("not a url")).toBeNull();
  });
  it("rejects non-http(s) schemes (file://, data:)", () => {
    expect(normalizeOrigin("file:///etc/passwd")).toBeNull();
    expect(normalizeOrigin("data:text/html,<script>")).toBeNull();
  });
});

describe("isOriginAllowed — exact membership only (Adversarial §3(h))", () => {
  const allow = ["https://example.com", "https://shop.example.com:443"];

  it("allows an exact match", () => {
    expect(isOriginAllowed("https://example.com", allow)).toBe(true);
  });
  it("rejects a null / missing origin (direct API call)", () => {
    expect(isOriginAllowed(null, allow)).toBe(false);
    expect(isOriginAllowed("null", allow)).toBe(false);
  });
  it("rejects an unlisted subdomain", () => {
    expect(isOriginAllowed("https://app.example.com", allow)).toBe(false);
  });
  it("rejects a look-alike / homograph domain", () => {
    expect(isOriginAllowed("https://evil-example.com", allow)).toBe(false);
    expect(isOriginAllowed("https://example.com.evil.com", allow)).toBe(false);
    expect(isOriginAllowed("https://examp1e.com", allow)).toBe(false);
  });
  it("rejects a scheme mismatch (http vs https)", () => {
    expect(isOriginAllowed("http://example.com", allow)).toBe(false);
  });
  it("tolerates trailing-slash / casing differences on a real match", () => {
    expect(isOriginAllowed("https://EXAMPLE.com/", allow)).toBe(true);
  });
  it("rejects everything against an empty allowlist", () => {
    expect(isOriginAllowed("https://example.com", [])).toBe(false);
  });
});

describe("buildFrameAncestors", () => {
  it("always includes 'self' and the normalized origins", () => {
    expect(buildFrameAncestors(["https://A.com/"])).toBe("'self' https://a.com");
  });
  it("drops malformed entries", () => {
    expect(buildFrameAncestors(["not-a-url", "https://b.com"])).toBe("'self' https://b.com");
  });
  it("is just 'self' for an empty allowlist", () => {
    expect(buildFrameAncestors([])).toBe("'self'");
  });
});

describe("buildWidgetLoaderJs", () => {
  it("JSON-encodes config values so they can't break out of the JS string", () => {
    const js = buildWidgetLoaderJs({
      token: "tok",
      baseUrl: "https://aipocketagency.com",
      personaName: 'Sales "Pro" </script>',
      greeting: "Hi",
      bubbleColor: "#22d3ee",
      position: "bottom-right",
    });
    // The raw closing tag must not appear unescaped in the emitted script.
    expect(js).not.toContain("</script>");
    expect(js).toContain("public-persona/tok?embed=1");
  });
});
