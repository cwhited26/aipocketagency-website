// gated-apps.test.ts — PA-POS-34: the tier gate applies to the composed spec, not the compose
// primitive. Pins (a) which composed Apps surface as gated per tier, (b) an active Project
// Pass clears its App from the gated list, (c) the review sentence prices the pass and ends on
// the owner's choice, (d) composing itself is never in the gated list on any tier.

import { describe, expect, it } from "vitest";
import { gatedAppOffers, gatedAppsSentence } from "../gated-apps";
import type { ProjectPass } from "@/lib/metering/passes";

const NOW = new Date("2026-07-03T12:00:00Z");

function pass(overrides: Partial<ProjectPass>): ProjectPass {
  return {
    id: "pass-1",
    appSlug: "browser_agent",
    grantedAt: "2026-07-01T00:00:00Z",
    expiresAt: "2026-07-08T00:00:00Z",
    remainingRunBudget: null,
    pricePaidCents: 3_000,
    tierAtPurchase: "starter",
    ...overrides,
  };
}

describe("gatedAppOffers (PA-POS-34)", () => {
  it("a starter owner's composed Browser Agent + Idea Engine surface with pass prices", () => {
    const offers = gatedAppOffers({
      tier: "starter",
      passes: [],
      appIds: ["email-drafter", "browser-agent", "idea-engine"],
      now: NOW,
    });
    expect(offers.map((o) => o.appId)).toEqual(["idea-engine", "browser-agent"]);
    const browser = offers.find((o) => o.appId === "browser-agent");
    expect(browser?.passPriceCents).toBe(3_000);
    expect(browser?.passWindowLabel).toBe("7 days");
    expect(browser?.includedInTierLabel).toBeTruthy();
  });

  it("a Studio+ owner has nothing gated", () => {
    const offers = gatedAppOffers({
      tier: "studio_plus",
      passes: [],
      appIds: ["browser-agent", "idea-engine", "landing-page-builder"],
      now: NOW,
    });
    expect(offers).toEqual([]);
  });

  it("an active Project Pass clears its App from the gated list — others stay", () => {
    const offers = gatedAppOffers({
      tier: "starter",
      passes: [pass({ appSlug: "browser_agent" })],
      appIds: ["browser-agent", "idea-engine"],
      now: NOW,
    });
    expect(offers.map((o) => o.appId)).toEqual(["idea-engine"]);
  });

  it("an expired pass gates again", () => {
    const offers = gatedAppOffers({
      tier: "starter",
      passes: [pass({ appSlug: "browser_agent", expiresAt: "2026-07-02T00:00:00Z" })],
      appIds: ["browser-agent"],
      now: NOW,
    });
    expect(offers.map((o) => o.appId)).toEqual(["browser-agent"]);
  });

  it("the compose primitive itself is never gated on any tier (PA-POS-34)", () => {
    for (const tier of ["starter", "pro", "pro_plus", "studio", "studio_plus"] as const) {
      const offers = gatedAppOffers({ tier, passes: [], appIds: ["agent-builder"], now: NOW });
      expect(offers).toEqual([]);
    }
  });

  it("gated Apps without a composed pick stay silent — a core-Apps toolkit yields no note", () => {
    const offers = gatedAppOffers({
      tier: "starter",
      passes: [],
      appIds: ["email-drafter", "followups", "daily-brief"],
      now: NOW,
    });
    expect(offers).toEqual([]);
    expect(gatedAppsSentence(offers)).toBe("");
  });
});

describe("gatedAppsSentence", () => {
  it("prices the pass, names the tier, and ends on the owner's choice", () => {
    const offers = gatedAppOffers({
      tier: "starter",
      passes: [],
      appIds: ["browser-agent"],
      now: NOW,
    });
    const sentence = gatedAppsSentence(offers);
    expect(sentence).toContain("Browser Agent");
    expect(sentence).toContain("$30 / 7 days");
    expect(sentence).toContain("Your call.");
    // Never a block: the sentence offers approve-as-is AND the scoped version.
    expect(sentence).toContain("Approve as-is");
    expect(sentence).toContain("scoped version");
  });
});
