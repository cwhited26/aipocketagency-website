import { describe, expect, it } from "vitest";
import { crossSubdomainCookieDomain } from "./cookies";

describe("crossSubdomainCookieDomain", () => {
  it("returns the dotted parent domain in production for aipocketagent.com hosts", () => {
    expect(crossSubdomainCookieDomain("aipocketagent.com", "production")).toBe(
      ".aipocketagent.com",
    );
    expect(crossSubdomainCookieDomain("app.aipocketagent.com", "production")).toBe(
      ".aipocketagent.com",
    );
    expect(crossSubdomainCookieDomain("APP.AIPocketAgent.com:443", "production")).toBe(
      ".aipocketagent.com",
    );
  });

  it("returns undefined outside production (dev / preview keep host-scoped cookies)", () => {
    expect(crossSubdomainCookieDomain("app.aipocketagent.com", "development")).toBeUndefined();
    expect(crossSubdomainCookieDomain("aipocketagent.com", "test")).toBeUndefined();
    expect(crossSubdomainCookieDomain("aipocketagent.com", undefined)).toBeUndefined();
  });

  it("returns undefined for non-aipocketagent hosts even in production", () => {
    expect(
      crossSubdomainCookieDomain("aipocketagency-website.vercel.app", "production"),
    ).toBeUndefined();
    expect(crossSubdomainCookieDomain("localhost:3000", "production")).toBeUndefined();
    expect(crossSubdomainCookieDomain(null, "production")).toBeUndefined();
    // A look-alike suffix must not match (guards against `evilaipocketagent.com`).
    expect(crossSubdomainCookieDomain("evilaipocketagent.com", "production")).toBeUndefined();
  });
});
