import { describe, expect, it } from "vitest";
import {
  APEX_HOST,
  APP_SUBDOMAIN_HOST,
  isApexHost,
  isAppSubdomain,
  routeForAppSubdomain,
} from "./routing";

describe("isAppSubdomain", () => {
  it("matches the app subdomain case-insensitively and ignores port", () => {
    expect(isAppSubdomain("app.aipocketagent.com")).toBe(true);
    expect(isAppSubdomain("APP.AIPocketAgent.com")).toBe(true);
    expect(isAppSubdomain("app.aipocketagent.com:443")).toBe(true);
  });

  it("does not match the apex or other hosts", () => {
    expect(isAppSubdomain("aipocketagent.com")).toBe(false);
    expect(isAppSubdomain("capture.aipocketagent.com")).toBe(false);
    expect(isAppSubdomain("localhost:3000")).toBe(false);
    expect(isAppSubdomain(null)).toBe(false);
  });
});

describe("isApexHost", () => {
  it("matches only the bare apex", () => {
    expect(isApexHost(APEX_HOST)).toBe(true);
    expect(isApexHost("AIPocketAgent.com:80")).toBe(true);
    expect(isApexHost(APP_SUBDOMAIN_HOST)).toBe(false);
    expect(isApexHost(null)).toBe(false);
  });
});

describe("routeForAppSubdomain", () => {
  it("rewrites bare app paths to the /app prefix", () => {
    expect(routeForAppSubdomain("/captures")).toEqual({
      kind: "rewrite",
      internalPath: "/app/captures",
    });
    expect(routeForAppSubdomain("/brain/map")).toEqual({
      kind: "rewrite",
      internalPath: "/app/brain/map",
    });
  });

  it("rewrites app-named paths even when a marketing route shares the name", () => {
    // The app has /app/launch-kit and /app/setup-sprint, so on the subdomain these
    // resolve to the app surface, not apex marketing.
    expect(routeForAppSubdomain("/launch-kit")).toEqual({
      kind: "rewrite",
      internalPath: "/app/launch-kit",
    });
    expect(routeForAppSubdomain("/setup")).toEqual({
      kind: "rewrite",
      internalPath: "/app/setup",
    });
  });

  it("passes through paths already under /app", () => {
    expect(routeForAppSubdomain("/app")).toEqual({ kind: "passthrough" });
    expect(routeForAppSubdomain("/app/captures")).toEqual({ kind: "passthrough" });
  });

  it("passes through API routes unchanged", () => {
    expect(routeForAppSubdomain("/api/app/pocket-capture/captures")).toEqual({
      kind: "passthrough",
    });
    expect(routeForAppSubdomain("/api/health")).toEqual({ kind: "passthrough" });
  });

  it("passes through static files at the root", () => {
    expect(routeForAppSubdomain("/manifest.webmanifest")).toEqual({ kind: "passthrough" });
    expect(routeForAppSubdomain("/icons/icon-192.png")).toEqual({ kind: "passthrough" });
    expect(routeForAppSubdomain("/robots.txt")).toEqual({ kind: "passthrough" });
  });

  it("redirects the root and apex-only marketing paths to the apex", () => {
    expect(routeForAppSubdomain("/")).toEqual({ kind: "redirect-apex" });
    expect(routeForAppSubdomain("/pricing")).toEqual({ kind: "redirect-apex" });
    expect(routeForAppSubdomain("/start")).toEqual({ kind: "redirect-apex" });
    expect(routeForAppSubdomain("/enterprise")).toEqual({ kind: "redirect-apex" });
    expect(routeForAppSubdomain("/training-confirmed")).toEqual({ kind: "redirect-apex" });
  });
});
