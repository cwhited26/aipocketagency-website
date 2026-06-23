import { describe, expect, it } from "vitest";
import {
  isPocketCaptureHost,
  pocketCaptureTargetPath,
  POCKET_CAPTURE_SEGMENT,
} from "./marketing-routing";

describe("isPocketCaptureHost", () => {
  it("matches the canonical capture subdomain", () => {
    expect(isPocketCaptureHost("capture.aipocketagent.com")).toBe(true);
  });

  it("ignores port and casing", () => {
    expect(isPocketCaptureHost("Capture.AIPocketAgent.com:443")).toBe(true);
    expect(isPocketCaptureHost("capture.localhost:3000")).toBe(true);
  });

  it("does not match the main marketing host or the app host", () => {
    expect(isPocketCaptureHost("aipocketagent.com")).toBe(false);
    expect(isPocketCaptureHost("app.aipocketagency.com")).toBe(false);
    expect(isPocketCaptureHost("www.capture.aipocketagent.com.evil.com")).toBe(false);
  });

  it("handles missing host", () => {
    expect(isPocketCaptureHost(null)).toBe(false);
    expect(isPocketCaptureHost(undefined)).toBe(false);
    expect(isPocketCaptureHost("")).toBe(false);
  });
});

describe("pocketCaptureTargetPath", () => {
  it("maps the root to the route-group segment", () => {
    expect(pocketCaptureTargetPath("/")).toBe(POCKET_CAPTURE_SEGMENT);
  });

  it("prefixes marketing sub-pages", () => {
    expect(pocketCaptureTargetPath("/privacy")).toBe("/pocket-capture/privacy");
    expect(pocketCaptureTargetPath("/terms")).toBe("/pocket-capture/terms");
  });

  it("passes API, share-target, app, and Next internals through untouched", () => {
    expect(pocketCaptureTargetPath("/api/pocket-capture/checkout")).toBeNull();
    expect(pocketCaptureTargetPath("/capture/share")).toBeNull();
    expect(pocketCaptureTargetPath("/app/feed")).toBeNull();
    expect(pocketCaptureTargetPath("/_next/static/chunk.js")).toBeNull();
  });

  it("does not rewrite already-prefixed paths (no loop)", () => {
    expect(pocketCaptureTargetPath("/pocket-capture")).toBeNull();
    expect(pocketCaptureTargetPath("/pocket-capture/privacy")).toBeNull();
  });

  it("leaves static asset files on their real path", () => {
    expect(pocketCaptureTargetPath("/favicon.ico")).toBeNull();
    expect(pocketCaptureTargetPath("/apple-touch-icon.png")).toBeNull();
    expect(pocketCaptureTargetPath("/manifest.webmanifest")).toBeNull();
  });
});
