import { describe, it, expect } from "vitest";
import { computeActivation, selectNudge, type ActivationInput } from "@/lib/activation/state";

const ZERO: ActivationInput = {
  businessBrainAssets: 0,
  personas: 0,
  workflows: 0,
  missionControlReviewed: false,
  launchpadJoined: false,
};

describe("computeActivation — the 7C progress ladder", () => {
  it("0% at a cold start", () => {
    const s = computeActivation(ZERO);
    expect(s.percent).toBe(0);
    expect(s.progressKey).toBe("start");
    expect(s.activated).toBe(false);
  });

  it("33% once Business Brain hits 3", () => {
    const s = computeActivation({ ...ZERO, businessBrainAssets: 3 });
    expect(s.percent).toBe(33);
    expect(s.progressKey).toBe("brain_ready");
    expect(s.pillars.businessBrain).toBe("complete");
  });

  it("stays 0% while Business Brain is only partial", () => {
    const s = computeActivation({ ...ZERO, businessBrainAssets: 2, personas: 3 });
    expect(s.percent).toBe(0);
    expect(s.pillars.businessBrain).toBe("partial");
  });

  it("66% with Brain + Personas complete", () => {
    const s = computeActivation({ ...ZERO, businessBrainAssets: 3, personas: 3 });
    expect(s.percent).toBe(66);
    expect(s.progressKey).toBe("personas_ready");
  });

  it("Personas do not count toward 66% until Brain is complete", () => {
    const s = computeActivation({ ...ZERO, businessBrainAssets: 1, personas: 5 });
    expect(s.percent).toBe(0);
  });

  it("90% with all three pillars but no Mission Control review", () => {
    const s = computeActivation({
      ...ZERO,
      businessBrainAssets: 3,
      personas: 3,
      workflows: 3,
    });
    expect(s.percent).toBe(90);
    expect(s.progressKey).toBe("almost");
    expect(s.activated).toBe(false);
  });

  it("100% and activated once Mission Control is reviewed", () => {
    const s = computeActivation({
      ...ZERO,
      businessBrainAssets: 4,
      personas: 3,
      workflows: 3,
      missionControlReviewed: true,
    });
    expect(s.percent).toBe(100);
    expect(s.progressKey).toBe("complete");
    expect(s.activated).toBe(true);
  });
});

describe("selectNudge — the 7W first-unmet-step lens", () => {
  it("no Business Brain → no_business_brain", () => {
    expect(selectNudge(ZERO)).toBe("no_business_brain");
  });

  it("has Brain, no Persona → business_brain_no_persona", () => {
    expect(selectNudge({ ...ZERO, businessBrainAssets: 1 })).toBe("business_brain_no_persona");
  });

  it("has Persona, no workflow → persona_no_workflow", () => {
    expect(selectNudge({ ...ZERO, businessBrainAssets: 1, personas: 1 })).toBe(
      "persona_no_workflow",
    );
  });

  it("has workflow, not reviewed → workflow_no_mission_control", () => {
    expect(
      selectNudge({ ...ZERO, businessBrainAssets: 1, personas: 1, workflows: 1 }),
    ).toBe("workflow_no_mission_control");
  });

  it("reviewed but not joined → no_launchpad_join", () => {
    expect(
      selectNudge({
        ...ZERO,
        businessBrainAssets: 1,
        personas: 1,
        workflows: 1,
        missionControlReviewed: true,
      }),
    ).toBe("no_launchpad_join");
  });

  it("fully activated → activation_complete", () => {
    expect(
      selectNudge({
        businessBrainAssets: 3,
        personas: 3,
        workflows: 3,
        missionControlReviewed: true,
        launchpadJoined: true,
      }),
    ).toBe("activation_complete");
  });

  it("first action everywhere + joined but pillars not all at 3 → no banner", () => {
    expect(
      selectNudge({
        businessBrainAssets: 1,
        personas: 1,
        workflows: 1,
        missionControlReviewed: true,
        launchpadJoined: true,
      }),
    ).toBeNull();
  });
});
