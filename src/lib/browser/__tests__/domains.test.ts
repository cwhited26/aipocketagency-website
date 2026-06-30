import { describe, it, expect } from "vitest";
import { hostOf, registrableDomain, domainOf, hostMatchesSuffix } from "../domains";

describe("hostOf", () => {
  it("extracts a lowercased host from http(s) URLs", () => {
    expect(hostOf("https://App.QuickBooks.com/path")).toBe("app.quickbooks.com");
    expect(hostOf("http://example.com")).toBe("example.com");
  });

  it("rejects non-http(s) and unparseable input", () => {
    expect(hostOf("file:///etc/passwd")).toBeNull();
    expect(hostOf("ftp://x.com")).toBeNull();
    expect(hostOf("not a url")).toBeNull();
  });
});

describe("registrableDomain", () => {
  it("reduces a host to its last two labels", () => {
    expect(registrableDomain("app.quickbooks.com")).toBe("quickbooks.com");
    expect(registrableDomain("quickbooks.com")).toBe("quickbooks.com");
  });

  it("keeps three labels for known multipart TLDs", () => {
    expect(registrableDomain("shop.foo.co.uk")).toBe("foo.co.uk");
    expect(registrableDomain("foo.com.au")).toBe("foo.com.au");
  });
});

describe("domainOf", () => {
  it("goes straight from URL to registrable domain", () => {
    expect(domainOf("https://api.app.quickbooks.com/v1")).toBe("quickbooks.com");
    expect(domainOf("bad")).toBeNull();
  });
});

describe("hostMatchesSuffix", () => {
  it("matches a host or its subdomains at label boundaries", () => {
    expect(hostMatchesSuffix("openai.com", "openai.com")).toBe(true);
    expect(hostMatchesSuffix("api.openai.com", "openai.com")).toBe(true);
    expect(hostMatchesSuffix("notopenai.com", "openai.com")).toBe(false);
  });
});
