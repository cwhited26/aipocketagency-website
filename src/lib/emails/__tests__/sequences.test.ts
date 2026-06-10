// sequences.test.ts — the enqueue plans and the activation decision logic are pure data/functions; pin
// the slugs, the send-at offsets, the tier→welcome mapping, and the missing-action / 3-3-3 logic.

import { describe, expect, it } from "vitest";
import {
  DIY_KIT_SEQUENCE,
  ONBOARDING_SEQUENCE,
  PILOT_SEQUENCE,
  dwySequence,
  planWelcomeSlug,
} from "../sequences";
import {
  isThreeThreeThree,
  pickMissingActionTrigger,
  type ActivationState,
} from "../activation";
import { backoffSendAt, MAX_ATTEMPTS } from "../sweep";
import { isTemplateSlug } from "../registry";

const DAY = 24 * 60;

describe("onboarding sequence", () => {
  it("is the 12 universal emails, Day-0 immediate, then daily", () => {
    expect(ONBOARDING_SEQUENCE).toHaveLength(12);
    expect(ONBOARDING_SEQUENCE[0]).toEqual({
      slug: "onboarding.day-0-purchase-confirmation",
      offsetMinutes: 0,
    });
    expect(ONBOARDING_SEQUENCE.find((s) => s.slug === "onboarding.day-7-activation")?.offsetMinutes).toBe(
      7 * DAY,
    );
    expect(ONBOARDING_SEQUENCE.find((s) => s.slug === "onboarding.day-14-retention")?.offsetMinutes).toBe(
      14 * DAY,
    );
  });

  it("every step is a real registered template", () => {
    for (const step of ONBOARDING_SEQUENCE) expect(isTemplateSlug(step.slug)).toBe(true);
  });
});

describe("pilot sequence", () => {
  it("is 18 emails ending at the Day-30 credit deadline", () => {
    expect(PILOT_SEQUENCE).toHaveLength(18);
    expect(PILOT_SEQUENCE.at(-1)).toEqual({
      slug: "pilot.day-30-final-credit-deadline",
      offsetMinutes: 30 * DAY,
    });
    for (const step of PILOT_SEQUENCE) expect(isTemplateSlug(step.slug)).toBe(true);
  });
});

describe("diy kit sequence", () => {
  it("is delivery (0) + Day+1 + Day+3", () => {
    expect(DIY_KIT_SEQUENCE.map((s) => s.offsetMinutes)).toEqual([0, 1 * DAY, 3 * DAY]);
  });
});

describe("dwy sequence", () => {
  it("standard has 3 steps, premium adds the 30-day check-in", () => {
    expect(dwySequence("standard")).toHaveLength(3);
    const premium = dwySequence("premium");
    expect(premium).toHaveLength(4);
    expect(premium.at(-1)).toEqual({ slug: "dwy.30-day-checkin", offsetMinutes: 30 * DAY });
    expect(dwySequence("premium")[2].slug).toBe("dwy.premium-reminder");
    expect(dwySequence("standard")[2].slug).toBe("dwy.standard-reminder");
  });
});

describe("planWelcomeSlug", () => {
  it("maps tiers to the right welcome fork", () => {
    expect(planWelcomeSlug("starter")).toBe("plan-specific.personal-brain-welcome");
    expect(planWelcomeSlug("pro")).toBe("plan-specific.business-agent-welcome");
    expect(planWelcomeSlug("pro_plus")).toBe("plan-specific.business-agent-welcome");
    expect(planWelcomeSlug("studio")).toBe("plan-specific.ai-agent-workspace-welcome");
    expect(planWelcomeSlug("studio_plus")).toBe("plan-specific.ai-agent-workspace-welcome");
    expect(planWelcomeSlug("enterprise")).toBe("plan-specific.ai-agent-workspace-welcome");
  });
});

describe("activation decision logic", () => {
  const state = (p: Partial<ActivationState>): ActivationState => ({
    bbAssets: 0,
    personaCount: 0,
    workflowCount: 0,
    reviewedCount: 0,
    ...p,
  });

  it("no Business Brain after 24h → no-bb reminder (but not before 24h)", () => {
    expect(pickMissingActionTrigger(state({}), 25)).toBe("triggers.no-bb-after-24h");
    expect(pickMissingActionTrigger(state({}), 10)).toBeNull();
  });

  it("BB but no persona → bb-no-persona", () => {
    expect(pickMissingActionTrigger(state({ bbAssets: 2 }), 100)).toBe("triggers.bb-no-persona");
  });

  it("persona but no workflow → persona-no-workflow", () => {
    expect(pickMissingActionTrigger(state({ bbAssets: 2, personaCount: 1 }), 100)).toBe(
      "triggers.persona-no-workflow",
    );
  });

  it("workflow but no review → workflow-no-mission-control", () => {
    expect(
      pickMissingActionTrigger(state({ bbAssets: 2, personaCount: 1, workflowCount: 1 }), 100),
    ).toBe("triggers.workflow-no-mission-control");
  });

  it("fully advanced → no missing-action reminder", () => {
    expect(
      pickMissingActionTrigger(
        state({ bbAssets: 3, personaCount: 3, workflowCount: 3, reviewedCount: 1 }),
        100,
      ),
    ).toBeNull();
  });

  it("3-3-3 only at 3/3/3", () => {
    expect(isThreeThreeThree(state({ bbAssets: 3, personaCount: 3, workflowCount: 3 }))).toBe(true);
    expect(isThreeThreeThree(state({ bbAssets: 3, personaCount: 2, workflowCount: 3 }))).toBe(false);
  });
});

describe("retry backoff", () => {
  it("is exponential and capped", () => {
    const now = 1_000_000;
    const min = (iso: string) => (Date.parse(iso) - now) / 60_000;
    expect(min(backoffSendAt(1, now))).toBe(5);
    expect(min(backoffSendAt(2, now))).toBe(10);
    expect(min(backoffSendAt(3, now))).toBe(20);
    expect(min(backoffSendAt(4, now))).toBe(40);
    expect(min(backoffSendAt(20, now))).toBe(6 * 60); // capped
  });

  it("caps attempts at 5", () => {
    expect(MAX_ATTEMPTS).toBe(5);
  });
});
