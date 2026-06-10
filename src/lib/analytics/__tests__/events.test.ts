import { describe, it, expect, vi } from "vitest";
import {
  trackEvent,
  isAnalyticsEvent,
  ANALYTICS_EVENTS,
  ACTIVATION_EVENTS,
} from "@/lib/analytics/events";

describe("analytics events (Part 7Z)", () => {
  it("exposes every Part 7Z activation milestone", () => {
    for (const slug of [
      "first_login",
      "business_brain_asset_added",
      "three_business_brain_assets_added",
      "persona_cloned",
      "three_personas_created",
      "workflow_installed",
      "three_workflows_installed",
      "mission_control_item_reviewed",
      "activation_333_completed",
      "launchpad_joined",
    ]) {
      expect(ACTIVATION_EVENTS).toContain(slug);
    }
  });

  it("has no duplicate slugs across all groups", () => {
    const set = new Set<string>(ANALYTICS_EVENTS);
    expect(set.size).toBe(ANALYTICS_EVENTS.length);
  });

  it("isAnalyticsEvent guards known and unknown slugs", () => {
    expect(isAnalyticsEvent("lead_scout_run")).toBe(true);
    expect(isAnalyticsEvent("not_a_real_event")).toBe(false);
  });

  it("trackEvent emits one structured analytics line and never throws", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    expect(() => trackEvent("pricing_viewed", { tier: "starter" })).not.toThrow();
    expect(spy).toHaveBeenCalledTimes(1);
    const line = spy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(line) as Record<string, unknown>;
    expect(parsed.scope).toBe("analytics");
    expect(parsed.event).toBe("pricing_viewed");
    expect(parsed.tier).toBe("starter");
    spy.mockRestore();
  });
});
