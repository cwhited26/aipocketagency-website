import { describe, it, expect } from "vitest";
import {
  isLaunchFunnelHost,
  launchFunnelTargetPath,
  LAUNCH_FUNNEL_HOST,
  LAUNCH_FUNNEL_SEGMENT,
} from "../routing";

describe("isLaunchFunnelHost", () => {
  it("matches the canonical host with or without a port", () => {
    expect(isLaunchFunnelHost(LAUNCH_FUNNEL_HOST)).toBe(true);
    expect(isLaunchFunnelHost("start.aipocketagent.com:443")).toBe(true);
    expect(isLaunchFunnelHost("START.AIPOCKETAGENT.COM")).toBe(true);
    expect(isLaunchFunnelHost("start.localhost:3000")).toBe(true);
  });

  it("does not match the apex, the app, or the capture host", () => {
    expect(isLaunchFunnelHost("aipocketagent.com")).toBe(false);
    expect(isLaunchFunnelHost("app.aipocketagent.com")).toBe(false);
    expect(isLaunchFunnelHost("capture.aipocketagent.com")).toBe(false);
    expect(isLaunchFunnelHost(null)).toBe(false);
    expect(isLaunchFunnelHost(undefined)).toBe(false);
  });
});

describe("launchFunnelTargetPath", () => {
  it("maps clean funnel paths onto the internal /launch segment", () => {
    expect(launchFunnelTargetPath("/")).toBe(LAUNCH_FUNNEL_SEGMENT);
    expect(launchFunnelTargetPath("/q/1")).toBe("/launch/q/1");
    expect(launchFunnelTargetPath("/start")).toBe("/launch/start");
    expect(launchFunnelTargetPath("/success")).toBe("/launch/success");
  });

  it("passes through API, app, internals, the segment itself, and static files", () => {
    expect(launchFunnelTargetPath("/api/pocket-agent/checkout")).toBeNull();
    expect(launchFunnelTargetPath("/app/brain")).toBeNull();
    expect(launchFunnelTargetPath("/_next/static/x.js")).toBeNull();
    expect(launchFunnelTargetPath("/launch")).toBeNull(); // no rewrite loop
    expect(launchFunnelTargetPath("/launch/start")).toBeNull();
    expect(launchFunnelTargetPath("/landing-hero.png")).toBeNull();
    expect(launchFunnelTargetPath("/favicon.ico")).toBeNull();
  });
});
