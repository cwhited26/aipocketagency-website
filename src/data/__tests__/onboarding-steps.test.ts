// PA-POS-36 registry pins: the six canonical steps, their deep links, the bonus sizing, and the
// voice gate — checklist copy is operator to-dos per voice/chase-spec.md §7/§10, so a copy edit
// that drifts chipper fails here, not in production.

import { describe, expect, it } from "vitest";
import {
  getOnboardingStep,
  isOnboardingStepSlug,
  ONBOARDING_COMPLETION_BONUS_CREDITS,
  ONBOARDING_STEP_BONUS_CREDITS,
  ONBOARDING_STEP_SLUGS,
  ONBOARDING_STEPS,
} from "../onboarding-steps";

describe("onboarding step registry", () => {
  it("holds exactly six steps, one per slug, in registry order", () => {
    expect(ONBOARDING_STEPS).toHaveLength(6);
    expect(ONBOARDING_STEPS.map((s) => s.slug)).toEqual([...ONBOARDING_STEP_SLUGS]);
    expect(new Set(ONBOARDING_STEP_SLUGS).size).toBe(6);
  });

  it("deep-links every step to an app-internal route", () => {
    for (const step of ONBOARDING_STEPS) {
      expect(step.href.startsWith("/"), `${step.slug} href`).toBe(true);
    }
  });

  it("marks only the teammate invite as skippable on starter", () => {
    const skippable = ONBOARDING_STEPS.filter((s) => s.skippableOnStarter);
    expect(skippable.map((s) => s.slug)).toEqual(["invite_teammate"]);
  });

  it("resolves slugs through the helpers", () => {
    expect(isOnboardingStepSlug("set_up_ritual")).toBe(true);
    expect(isOnboardingStepSlug("click_to_complete")).toBe(false);
    expect(getOnboardingStep("connect_tool").href).toBe("/app/settings/connections");
    expect(getOnboardingStep("compose_agent").href).toBe("/agents#compose");
  });

  it("pins the bonus sizing: 50 per step, 250 on completion, 550 total", () => {
    expect(ONBOARDING_STEP_BONUS_CREDITS).toBe(50);
    expect(ONBOARDING_COMPLETION_BONUS_CREDITS).toBe(250);
    expect(
      ONBOARDING_STEPS.length * ONBOARDING_STEP_BONUS_CREDITS +
        ONBOARDING_COMPLETION_BONUS_CREDITS,
    ).toBe(550);
  });
});

describe("voice gate (chase-spec §7/§10)", () => {
  // Operator to-dos, not a game. Chipper tells + spec anti-patterns fail the build.
  const BANNED = [
    "!",
    "woohoo",
    "time to",
    "let's",
    "excited",
    "amazing",
    "awesome",
    "supercharge",
    "unlock your",
    "empower",
    "leverage",
    "moving forward",
    "best practice",
    "genuinely",
    "honestly",
    "straightforward",
    "in a moment",
    "quickly",
    "shortly",
    "🎉",
  ];

  it("keeps every step title and detail on the operator register", () => {
    for (const step of ONBOARDING_STEPS) {
      const text = `${step.title} ${step.detail}`.toLowerCase();
      for (const phrase of BANNED) {
        expect(text.includes(phrase), `${step.slug} contains "${phrase}"`).toBe(false);
      }
    }
  });

  it("titles are imperative to-dos, not announcements", () => {
    for (const step of ONBOARDING_STEPS) {
      // No trailing punctuation, no leading "You" framing.
      expect(/[.!?]$/.test(step.title), `${step.slug} title punctuation`).toBe(false);
      expect(step.title.startsWith("You"), `${step.slug} title framing`).toBe(false);
    }
  });
});
