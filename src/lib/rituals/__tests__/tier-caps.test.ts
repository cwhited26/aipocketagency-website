// Unit tests for the Ritual Scheduler tier caps (lib/personas/tier-caps, PA-RITUAL-8). Asserts the
// active-ritual ladder matches SPEC §9 and the activate decision gates at the cap with a reason.

import { describe, expect, it } from "vitest";
import {
  RITUAL_ACTIVE_CAPS,
  ritualActiveCap,
  evaluateCanActivateRitual,
} from "@/lib/personas/tier-caps";

describe("RITUAL_ACTIVE_CAPS", () => {
  it("matches the SPEC §9 ladder", () => {
    expect(RITUAL_ACTIVE_CAPS).toEqual({
      starter: 1,
      pro: 5,
      pro_plus: 10,
      studio: 25,
      studio_plus: 100,
      enterprise: 100,
    });
  });

  it("ritualActiveCap reads the per-tier cap", () => {
    expect(ritualActiveCap("starter")).toBe(1);
    expect(ritualActiveCap("studio")).toBe(25);
  });
});

describe("evaluateCanActivateRitual", () => {
  it("allows a new ritual below the cap", () => {
    expect(evaluateCanActivateRitual("pro", 4).ok).toBe(true);
  });

  it("blocks at the cap with a reason", () => {
    const d = evaluateCanActivateRitual("pro", 5);
    expect(d.ok).toBe(false);
    expect(d.reason).toMatch(/all 5 rituals/);
  });

  it("uses the singular copy at the starter cap of 1", () => {
    const d = evaluateCanActivateRitual("starter", 1);
    expect(d.ok).toBe(false);
    expect(d.reason).toMatch(/1 ritual at a time/);
  });
});
