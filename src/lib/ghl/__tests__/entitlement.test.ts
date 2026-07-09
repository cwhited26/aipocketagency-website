// Tier enforcement (PA-GHL-6) — the client-cap table and the pure cap resolution the executor
// and the location sync both ride.

import { describe, expect, it } from "vitest";
import { GHL_PASS_CLIENT_CAP, resolveGhlClientCap } from "../entitlement";
import {
  GHL_CLIENT_CAPS,
  ghlClientCap,
  tierAllowsGhlConnector,
  tierCanSeeGhlConnector,
} from "@/lib/personas/tier-caps";

describe("GHL_CLIENT_CAPS (PA-GHL-6 Option B lock)", () => {
  it("pins the per-tier client caps: 0 / 0 / 3 / 10 / 25 / uncapped", () => {
    expect(GHL_CLIENT_CAPS).toEqual({
      starter: 0,
      pro: 0,
      pro_plus: 3,
      studio: 10,
      studio_plus: 25,
      enterprise: null,
    });
    expect(ghlClientCap("studio")).toBe(10);
    expect(ghlClientCap("enterprise")).toBeNull();
  });

  it("the connector is tier-included at Pro+ and up, visible at Business Agent and up", () => {
    expect(tierAllowsGhlConnector("starter")).toBe(false);
    expect(tierAllowsGhlConnector("pro")).toBe(false);
    expect(tierAllowsGhlConnector("pro_plus")).toBe(true);
    expect(tierAllowsGhlConnector("studio_plus")).toBe(true);
    expect(tierCanSeeGhlConnector("starter")).toBe(false);
    expect(tierCanSeeGhlConnector("pro")).toBe(true);
  });
});

describe("resolveGhlClientCap", () => {
  it("tier entitlement uses the tier's cap", () => {
    expect(resolveGhlClientCap("pro_plus", "tier")).toBe(3);
    expect(resolveGhlClientCap("studio", "tier")).toBe(10);
    expect(resolveGhlClientCap("studio_plus", "tier")).toBe(25);
    expect(resolveGhlClientCap("enterprise", "tier")).toBeNull();
  });

  it("a Project Pass rents exactly ONE client regardless of tier (Business Agent PoC)", () => {
    expect(GHL_PASS_CLIENT_CAP).toBe(1);
    expect(resolveGhlClientCap("pro", "project_pass")).toBe(1);
    expect(resolveGhlClientCap("starter", "project_pass")).toBe(1);
  });

  it("no entitlement means zero clients", () => {
    expect(resolveGhlClientCap("pro", null)).toBe(0);
  });
});
