// lib/activation/state.ts — the 3-3-3 activation model (GTM Phase 4, Part 7C + 7W).
//
// "3-3-3 activation" = 3 Business Brain assets, 3 trained Personas, 3 working workflows. The whole
// in-app experience is built to move the owner along that path, so the math lives in one pure,
// unit-tested place (no copy strings, no React) and both the dashboard widget and the nudge banner
// read from it. Copy strings keyed off these enums live in lib/copy/in-app.ts.

/** The three activation pillars plus the two milestone steps the 7C widget surfaces. */
export type ActivationInput = {
  businessBrainAssets: number;
  personas: number;
  workflows: number;
  missionControlReviewed: boolean;
  launchpadJoined: boolean;
};

/** Where the owner sits on a single pillar. */
export type PillarState = "empty" | "partial" | "complete";

/** Drives which 7C progress-copy block renders. Maps 1:1 to 0 / 33 / 66 / 90 / 100 percent. */
export type ProgressCopyKey = "start" | "brain_ready" | "personas_ready" | "almost" | "complete";

/** Drives which 7W dashboard nudge renders (or none when the owner is mid-step). */
export type NudgeKey =
  | "no_business_brain"
  | "business_brain_no_persona"
  | "persona_no_workflow"
  | "workflow_no_mission_control"
  | "no_launchpad_join"
  | "activation_complete";

const PILLAR_TARGET = 3;

export type ActivationState = {
  input: ActivationInput;
  pillars: {
    businessBrain: PillarState;
    personas: PillarState;
    workflows: PillarState;
  };
  /** 0 / 33 / 66 / 90 / 100, matching the five 7C progress-copy blocks. */
  percent: 0 | 33 | 66 | 90 | 100;
  progressKey: ProgressCopyKey;
  /** True only when all three pillars hit 3 AND the owner reviewed in Mission Control. */
  activated: boolean;
};

function pillarState(count: number): PillarState {
  if (count <= 0) return "empty";
  if (count >= PILLAR_TARGET) return "complete";
  return "partial";
}

/**
 * Compute the dashboard activation state. The percentage follows the 7C ladder: a pillar counts as
 * "done" only when it reaches 3. 0 pillars = 0%, then +33 per completed pillar through Business
 * Brain → Personas → Workflows in order; all three done lands at 90% (review pending) and 100% once
 * Mission Control has been reviewed. The order is intentional — Personas don't count toward 66%
 * until Business Brain is complete, because a Persona with no context isn't useful work.
 */
export function computeActivation(input: ActivationInput): ActivationState {
  const businessBrain = pillarState(input.businessBrainAssets);
  const personas = pillarState(input.personas);
  const workflows = pillarState(input.workflows);

  const brainDone = businessBrain === "complete";
  const personasDone = brainDone && personas === "complete";
  const workflowsDone = personasDone && workflows === "complete";

  let percent: ActivationState["percent"] = 0;
  let progressKey: ProgressCopyKey = "start";
  if (workflowsDone && input.missionControlReviewed) {
    percent = 100;
    progressKey = "complete";
  } else if (workflowsDone) {
    percent = 90;
    progressKey = "almost";
  } else if (personasDone) {
    percent = 66;
    progressKey = "personas_ready";
  } else if (brainDone) {
    percent = 33;
    progressKey = "brain_ready";
  }

  return {
    input,
    pillars: { businessBrain, personas, workflows },
    percent,
    progressKey,
    activated: workflowsDone && input.missionControlReviewed,
  };
}

/**
 * Pick the single dashboard nudge to surface (Part 7W), or null when the owner is mid-pillar and
 * doesn't need a banner. This is a first-unmet-step lens (fires on count === 0), distinct from the
 * widget's pillar-completion percentage: the goal is to point at the very next action.
 */
export function selectNudge(input: ActivationInput): NudgeKey | null {
  if (input.businessBrainAssets <= 0) return "no_business_brain";
  if (input.personas <= 0) return "business_brain_no_persona";
  if (input.workflows <= 0) return "persona_no_workflow";
  if (!input.missionControlReviewed) return "workflow_no_mission_control";

  const fullyActivated =
    input.businessBrainAssets >= PILLAR_TARGET &&
    input.personas >= PILLAR_TARGET &&
    input.workflows >= PILLAR_TARGET &&
    input.missionControlReviewed;

  if (!input.launchpadJoined) return "no_launchpad_join";
  if (fullyActivated) return "activation_complete";
  // First action on every step done, but not all pillars at 3 yet — keep building, no banner.
  return null;
}
