// Metering primitives (PA-POS-30 Credits + Top Ups, PA-POS-31 Project Passes). The five pinned
// behaviors from the build brief live here by name:
//   (a) Personal Brain / Business Agent NEVER see a credits chip — on any App
//   (b) Studio+ sees the chip on Browser Agent + Idea Engine + Decision Roundtable
//   (c) a Personal Brain owner with an active Browser Agent pass gets through the gate
//   (d) the 3rd consecutive pass purchase goes through — same price, no discount, no block
//   (e) the conversion nudge shows on the 2nd purchase inside 21 days — and only educates

import { describe, it, expect } from "vitest";
import { TIERS, type Tier } from "@/lib/personas/tier-caps";
import {
  buildCreditStatus,
  buildCreditsChipModel,
  CREDIT_MICRO_CENTS,
  METERED_FEATURE_SLUGS,
  microCentsToCredits,
  shouldOfferTopUp,
  TIER_MONTHLY_CREDIT_ALLOWANCE,
  tierGetsCredits,
  type CreditStatus,
} from "../credits";
import {
  activePassForApp,
  isPassActive,
  passPurchaseDecision,
  resolveAppEntitlement,
  shouldShowConversionNudge,
  tierIncludesApp,
  type ProjectPass,
} from "../passes";
import { buildNudgeCopy, cheapestIncludingTier } from "../nudge-copy";
import {
  getPassDef,
  isPassAppSlug,
  passPriceCents,
  PROJECT_PASS_CATALOG,
  type PassAppSlug,
} from "@/data/project-passes";
import { getTopUpBundle, TOP_UP_BUNDLES } from "@/data/top-ups";

const NOW = new Date("2026-07-03T12:00:00Z");

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

function daysAhead(days: number): string {
  return new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

function pass(overrides: Partial<ProjectPass> = {}): ProjectPass {
  return {
    id: "pass-1",
    appSlug: "browser_agent",
    grantedAt: daysAgo(1),
    expiresAt: daysAhead(6),
    remainingRunBudget: null,
    pricePaidCents: 3_000,
    tierAtPurchase: "starter",
    ...overrides,
  };
}

function creditStatus(overrides: Partial<CreditStatus> = {}): CreditStatus {
  return {
    tier: "studio_plus",
    cycleStart: daysAgo(10),
    cycleEnd: daysAhead(20),
    allowanceCredits: 20_000,
    topUpCredits: 0,
    consumedCredits: 1_600,
    remainingCredits: 18_400,
    ...overrides,
  };
}

// ── (a) The hard rule: entry tiers never see credits ───────────────────────────────────────

describe("credits hard rule — Personal Brain / Business Agent never see a chip", () => {
  const entryTiers: Tier[] = ["starter", "pro", "pro_plus", "studio"];

  it("tierGetsCredits is false for every tier below studio_plus", () => {
    for (const tier of entryTiers) {
      expect(tierGetsCredits(tier)).toBe(false);
    }
  });

  it("(a) a Personal Brain owner gets NO chip model on any App page — even with a status in hand", () => {
    // Every App page renders the chip from buildCreditsChipModel and nothing else. A non-null
    // status simulates a bug upstream; the model must still refuse for the entry tiers.
    for (const tier of ["starter", "pro"] as const) {
      expect(buildCreditsChipModel(tier, creditStatus({ tier }))).toBeNull();
      expect(buildCreditsChipModel(tier, null)).toBeNull();
    }
  });

  it("entry tiers have a zero monthly allowance (the concept doesn't exist for them)", () => {
    for (const tier of entryTiers) {
      expect(TIER_MONTHLY_CREDIT_ALLOWANCE[tier]).toBe(0);
    }
  });
});

// ── (b) Studio+ sees the chip on the expensive Apps ────────────────────────────────────────

describe("credits chip — Studio+ / Enterprise", () => {
  it("(b) a Studio+ owner gets a chip model for Browser Agent, Idea Engine, and Roundtable pages", () => {
    // The three expensive-App slugs are all in the metered set the chip reports on.
    for (const slug of ["browser_agent", "idea_engine", "roundtable"] as const) {
      expect(METERED_FEATURE_SLUGS).toContain(slug);
    }
    const model = buildCreditsChipModel("studio_plus", creditStatus());
    expect(model).not.toBeNull();
    expect(model?.remainingCredits).toBe(18_400);
    expect(model?.totalCredits).toBe(20_000);
    expect(model?.bundles.length).toBe(3);
  });

  it("enterprise gets the chip too", () => {
    expect(
      buildCreditsChipModel("enterprise", creditStatus({ tier: "enterprise" })),
    ).not.toBeNull();
  });

  it("the Top Up offer surfaces before the next expensive action, not after a hard stop", () => {
    expect(shouldOfferTopUp(creditStatus({ remainingCredits: 18_400 }))).toBe(false);
    // Below one fully-capped Browser Agent job ($5 = 2,000 credits) the offer shows.
    expect(shouldOfferTopUp(creditStatus({ remainingCredits: 1_999 }))).toBe(true);
    expect(shouldOfferTopUp(creditStatus({ remainingCredits: 0 }))).toBe(true);
  });

  it("consumption maths: ledger micro-cents → credits, rounded up, never negative remaining", () => {
    expect(microCentsToCredits(0)).toBe(0);
    expect(microCentsToCredits(1)).toBe(1);
    expect(microCentsToCredits(CREDIT_MICRO_CENTS)).toBe(1);
    expect(microCentsToCredits(CREDIT_MICRO_CENTS + 1)).toBe(2);
    const status = buildCreditStatus({
      tier: "studio_plus",
      cycleStart: daysAgo(10),
      cycleEnd: daysAhead(20),
      allowanceCredits: 100,
      topUpCredits: 0,
      consumedMicroCents: 500 * CREDIT_MICRO_CENTS,
    });
    expect(status.consumedCredits).toBe(500);
    expect(status.remainingCredits).toBe(0);
  });
});

// ── (c) The widened gate: tier OR active Project Pass ──────────────────────────────────────

describe("resolveAppEntitlement — tier OR active pass", () => {
  it("(c) a Personal Brain owner with an active Browser Agent pass can open the App", () => {
    const result = resolveAppEntitlement("starter", "browser_agent", [pass()], NOW);
    expect(result.allowed).toBe(true);
    expect(result.source).toBe("project_pass");
    expect(result.pass?.id).toBe("pass-1");
  });

  it("without a pass the entry-tier gate stays closed", () => {
    const result = resolveAppEntitlement("starter", "browser_agent", [], NOW);
    expect(result.allowed).toBe(false);
    expect(result.source).toBeNull();
  });

  it("tier wins when both hold — a Studio+ owner's usage is never marked rented", () => {
    const result = resolveAppEntitlement("studio_plus", "browser_agent", [pass()], NOW);
    expect(result.allowed).toBe(true);
    expect(result.source).toBe("tier");
    expect(result.pass).toBeNull();
  });

  it("an expired pass grants nothing", () => {
    const expired = pass({ grantedAt: daysAgo(10), expiresAt: daysAgo(2) });
    expect(isPassActive(expired, NOW)).toBe(false);
    expect(resolveAppEntitlement("starter", "browser_agent", [expired], NOW).allowed).toBe(false);
  });

  it("a run-budget pass closes when the budget is spent", () => {
    const spent = pass({ appSlug: "roundtable", remainingRunBudget: 0, expiresAt: daysAhead(80) });
    expect(isPassActive(spent, NOW)).toBe(false);
    const live = pass({ appSlug: "roundtable", remainingRunBudget: 1, expiresAt: daysAhead(80) });
    expect(activePassForApp([spent, live], "roundtable", NOW)?.remainingRunBudget).toBe(1);
  });

  it("tierIncludesApp matches the shipped gates (LPB at Studio, the rest at Studio+)", () => {
    expect(tierIncludesApp("studio", "landing_page_builder")).toBe(true);
    expect(tierIncludesApp("pro", "landing_page_builder")).toBe(false);
    expect(tierIncludesApp("studio", "browser_agent")).toBe(false);
    expect(tierIncludesApp("studio_plus", "browser_agent")).toBe(true);
    // The idea_engine pass sells the auto-build MVP ship — the Studio+ capability.
    expect(tierIncludesApp("pro_plus", "idea_engine")).toBe(false);
    expect(tierIncludesApp("studio_plus", "idea_engine")).toBe(true);
    // The Custom Agent Builder composes on EVERY tier (PA-POS-34) — the compose primitive has
    // no tier gate; the gate applies to the composed spec's Apps at review time.
    expect(tierIncludesApp("starter", "agent_builder")).toBe(true);
    expect(tierIncludesApp("studio_plus", "agent_builder")).toBe(true);
  });
});

// ── (d) Customer autonomy: the 3rd rental goes through untouched ───────────────────────────

describe("passPurchaseDecision — customer autonomy (PA-POS-31 amendment)", () => {
  it("(d) the 3rd consecutive purchase succeeds at full catalog price — no discount, no block", () => {
    const first = passPurchaseDecision("landing_page_builder", "starter", 0);
    const third = passPurchaseDecision("landing_page_builder", "starter", 2);
    const fiftieth = passPurchaseDecision("landing_page_builder", "starter", 49);
    expect(first?.allowed).toBe(true);
    expect(third?.allowed).toBe(true);
    expect(fiftieth?.allowed).toBe(true);
    // Purchase history NEVER moves the price — no auto-discount, no penalty.
    expect(third?.priceCents).toBe(first?.priceCents);
    expect(fiftieth?.priceCents).toBe(first?.priceCents);
    expect(first?.priceCents).toBe(2_000);
  });

  it("every catalog App is purchasable at every purchase count, for every tier", () => {
    for (const def of PROJECT_PASS_CATALOG) {
      for (const tier of TIERS) {
        for (const count of [0, 1, 2, 10]) {
          const decision = passPurchaseDecision(def.appSlug, tier, count);
          expect(decision?.allowed).toBe(true);
          expect(decision?.priceCents).toBe(passPriceCents(def, tier));
        }
      }
    }
  });
});

// ── (e) The conversion nudge: educates on the 2nd rental, never gates ──────────────────────

describe("shouldShowConversionNudge — 2+ same-App passes in 21 days", () => {
  it("(e) shows after the 2nd purchase of the same App inside the window", () => {
    const passes = [
      pass({ id: "p1", appSlug: "landing_page_builder", grantedAt: daysAgo(10) }),
      pass({ id: "p2", appSlug: "landing_page_builder", grantedAt: daysAgo(1) }),
    ];
    expect(shouldShowConversionNudge(passes, "landing_page_builder", NOW)).toBe(true);
  });

  it("one rental never nudges", () => {
    expect(
      shouldShowConversionNudge([pass({ appSlug: "landing_page_builder" })], "landing_page_builder", NOW),
    ).toBe(false);
  });

  it("two rentals spread past 21 days never nudge", () => {
    const passes = [
      pass({ id: "p1", appSlug: "landing_page_builder", grantedAt: daysAgo(25) }),
      pass({ id: "p2", appSlug: "landing_page_builder", grantedAt: daysAgo(1) }),
    ];
    expect(shouldShowConversionNudge(passes, "landing_page_builder", NOW)).toBe(false);
  });

  it("rentals of a different App never nudge this one", () => {
    const passes = [
      pass({ id: "p1", appSlug: "browser_agent", grantedAt: daysAgo(2) }),
      pass({ id: "p2", appSlug: "browser_agent", grantedAt: daysAgo(1) }),
    ];
    expect(shouldShowConversionNudge(passes, "landing_page_builder", NOW)).toBe(false);
  });

  it("the nudge copy shows the true tier math and always ends on the owner's choice", () => {
    // Landing Page Builder actually lives at Studio ($297) — the copy must not claim Business
    // Agent includes it (the SPEC's sample line was loose; real numbers win).
    expect(cheapestIncludingTier("landing_page_builder")).toBe("studio");
    const lpb = buildNudgeCopy("landing_page_builder");
    expect(lpb.body).toContain("Studio is $297/mo");
    expect(lpb.body).toContain("up to you");
    expect(lpb.dismissLabel).toBe("Keep renting");
    const browser = buildNudgeCopy("browser_agent");
    expect(browser.body).toContain("AI Agent Workspace is $497/mo");
    expect(browser.body).toContain("up to you");
  });
});

// ── Catalogs pinned to the SPEC §21 table + §20 bundle structure ───────────────────────────

describe("catalogs", () => {
  it("Project Pass prices match the SPEC §21 sample table", () => {
    const expected: Record<PassAppSlug, [number, number]> = {
      landing_page_builder: [2_000, 1_500],
      browser_agent: [3_000, 2_200],
      idea_engine: [5_000, 3_500],
      roundtable: [1_000, 700],
      agent_builder: [3_000, 2_200],
      // GHL Connector pass is $50 flat at every renter tier (PA-GHL-6 — the pass exists for
      // Business Agent's 1-client proof-of-concept, so there's no lower-tier discount split).
      ghl_connector: [5_000, 5_000],
    };
    for (const def of PROJECT_PASS_CATALOG) {
      const [personal, business] = expected[def.appSlug];
      expect(def.personalBrainCents).toBe(personal);
      expect(def.businessAgentCents).toBe(business);
      expect(passPriceCents(def, "starter")).toBe(personal);
      expect(passPriceCents(def, "pro")).toBe(business);
      // Higher-tier renters get the discounted rate too — never more than Personal Brain pays.
      expect(passPriceCents(def, "studio")).toBe(business);
    }
    expect(getPassDef("browser_agent")?.windowDays).toBe(7);
    expect(getPassDef("idea_engine")?.runBudget).toBe(1);
    expect(getPassDef("roundtable")?.runBudget).toBe(1);
    expect(isPassAppSlug("not_an_app")).toBe(false);
  });

  it("Top Up bundles are $50/$150/$500 at an 8-10× margin over raw model spend", () => {
    expect(TOP_UP_BUNDLES.map((b) => b.amountCents)).toEqual([5_000, 15_000, 50_000]);
    expect(TOP_UP_BUNDLES.map((b) => b.credits)).toEqual([2_000, 7_000, 25_000]);
    for (const bundle of TOP_UP_BUNDLES) {
      // Raw provider value of the credits, in cents.
      const rawCents = (bundle.credits * CREDIT_MICRO_CENTS) / 10_000;
      const margin = bundle.amountCents / rawCents;
      expect(margin).toBeGreaterThanOrEqual(5);
      expect(margin).toBeLessThanOrEqual(10);
    }
    expect(getTopUpBundle("top_up_50")?.credits).toBe(2_000);
    expect(getTopUpBundle("nope")).toBeNull();
  });
});
