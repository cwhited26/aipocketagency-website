import { describe, it, expect } from "vitest";
import {
  BUILD_CONNECTORS,
  CONNECTIONS_HREF,
  buildConnectorHref,
  tierBuildsOnPlatform,
  requiredBuildConnectors,
  launchKitConnectItems,
  missingBuildConnectors,
  missingBuildConnectorCount,
  connectPillLabel,
  type BuildConnectionState,
} from "@/lib/build-tools/onboarding";

const NONE: BuildConnectionState = { github_build: false, vercel: false, supabase: false };
const ALL: BuildConnectionState = { github_build: true, vercel: true, supabase: true };

describe("buildConnectorHref", () => {
  it("routes GitHub to its OAuth start when configured", () => {
    expect(buildConnectorHref("github_build", { githubOAuthConfigured: true })).toBe(
      "/api/connectors/github-build/start",
    );
  });
  it("falls GitHub back to the Connections page when OAuth isn't configured", () => {
    expect(buildConnectorHref("github_build", { githubOAuthConfigured: false })).toBe(CONNECTIONS_HREF);
  });
  it("routes paste-token connectors to the Connections page", () => {
    expect(buildConnectorHref("vercel", { githubOAuthConfigured: true })).toBe(CONNECTIONS_HREF);
    expect(buildConnectorHref("supabase", { githubOAuthConfigured: true })).toBe(CONNECTIONS_HREF);
  });
});

describe("requiredBuildConnectors", () => {
  it("requires nothing for tiers that don't build on the platform", () => {
    expect(tierBuildsOnPlatform("starter")).toBe(false);
    expect(requiredBuildConnectors("starter")).toEqual([]);
    expect(requiredBuildConnectors("pro")).toEqual([]);
    expect(requiredBuildConnectors("pro_plus")).toEqual([]);
  });
  it("requires GitHub + Vercel at Studio (landing pages, no auto-build)", () => {
    expect(requiredBuildConnectors("studio")).toEqual(["github_build", "vercel"]);
  });
  it("adds Supabase at Studio+ (full auto-build)", () => {
    expect(requiredBuildConnectors("studio_plus")).toEqual(["github_build", "vercel", "supabase"]);
    expect(requiredBuildConnectors("enterprise")).toEqual(["github_build", "vercel", "supabase"]);
  });
});

describe("launchKitConnectItems", () => {
  it("is empty for non-build tiers", () => {
    expect(launchKitConnectItems({ tier: "pro", connected: NONE, githubOAuthConfigured: true })).toEqual([]);
  });
  it("carries the canonical copy and live connected state", () => {
    const items = launchKitConnectItems({
      tier: "studio_plus",
      connected: { github_build: true, vercel: false, supabase: false },
      githubOAuthConfigured: true,
    });
    expect(items.map((i) => i.id)).toEqual(["github_build", "vercel", "supabase"]);
    expect(items[0].title).toBe(BUILD_CONNECTORS.github_build.launchKitTitle);
    expect(items[0].connected).toBe(true);
    expect(items[1].connected).toBe(false);
    // GitHub connected → its href is still the OAuth start (used only when not connected in the UI).
    expect(items[2].buttonLabel).toBe(BUILD_CONNECTORS.supabase.buttonLabel);
  });
});

describe("missingBuildConnectors", () => {
  it("returns only the connectors still missing", () => {
    const missing = missingBuildConnectors({
      ids: requiredBuildConnectors("studio_plus"),
      connected: { github_build: true, vercel: false, supabase: false },
      githubOAuthConfigured: false,
    });
    expect(missing.map((m) => m.id)).toEqual(["vercel", "supabase"]);
    expect(missing[0].buttonLabel).toBe("Connect Vercel →");
  });
  it("returns nothing when everything is connected", () => {
    expect(
      missingBuildConnectors({
        ids: requiredBuildConnectors("studio_plus"),
        connected: ALL,
        githubOAuthConfigured: true,
      }),
    ).toEqual([]);
  });
});

describe("missingBuildConnectorCount", () => {
  it("counts the gap for the tier", () => {
    expect(missingBuildConnectorCount("studio", NONE)).toBe(2);
    expect(missingBuildConnectorCount("studio_plus", NONE)).toBe(3);
    expect(missingBuildConnectorCount("studio_plus", ALL)).toBe(0);
    expect(missingBuildConnectorCount("pro", NONE)).toBe(0);
  });
});

describe("connectPillLabel", () => {
  it("pluralizes", () => {
    expect(connectPillLabel(1)).toBe("Connect 1 thing to use →");
    expect(connectPillLabel(2)).toBe("Connect 2 things to use →");
    expect(connectPillLabel(3)).toBe("Connect 3 things to use →");
  });
});
