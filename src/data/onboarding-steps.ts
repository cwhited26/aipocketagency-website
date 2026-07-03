// Onboarding step registry (PA-POS-36). Six canonical steps, common to every tier and every
// workspace. Completion is DETECTED server-side by the code path that performs the underlying
// action (lib/onboarding/progress.ts hooks) — there is no click-to-complete write path. The one
// exception is the teammate invite on Personal Brain (starter), which is optional and may be
// skipped from the checklist (the skip is an opt-out, not a claim of work).
//
// Copy is operator to-dos per voice/chase-spec.md — no cheer, no exclamation points. The vitest
// voice gate in src/data/__tests__/onboarding-steps.test.ts pins that.

export const ONBOARDING_STEP_SLUGS = [
  "connect_tool",
  "compose_agent",
  "approve_inbox",
  "name_persona",
  "set_up_ritual",
  "invite_teammate",
] as const;

export type OnboardingStepSlug = (typeof ONBOARDING_STEP_SLUGS)[number];

export function isOnboardingStepSlug(value: string): value is OnboardingStepSlug {
  return (ONBOARDING_STEP_SLUGS as readonly string[]).includes(value);
}

export type OnboardingStep = {
  slug: OnboardingStepSlug;
  /** Operator to-do, not a game prompt. */
  title: string;
  /** One line under the title — what the step is and why it matters. */
  detail: string;
  /** The shipped route that completes the step (deep link on the checklist). */
  href: string;
  /** Steps an owner on Personal Brain (starter) can skip from the checklist. */
  skippableOnStarter?: boolean;
};

export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  {
    slug: "connect_tool",
    title: "Connect your first tool",
    detail: "Gmail, Slack, or Google Calendar — one connection gives your agent somewhere to work.",
    href: "/app/settings/connections",
  },
  {
    slug: "compose_agent",
    title: "Compose your first agent",
    detail: "Describe the agent you need and PA assembles it. Picking a vertical seeds one too.",
    href: "/agents#compose",
  },
  {
    slug: "approve_inbox",
    title: "Approve your first inbox item",
    detail: "Nothing fires without your sign-off. Approve one item to run the loop end to end.",
    href: "/app/apps/inbox",
  },
  {
    slug: "name_persona",
    title: "Name a Persona",
    detail: "Rename one so it reads like your team, not a template.",
    href: "/app/personas",
  },
  {
    slug: "set_up_ritual",
    title: "Set up a Ritual",
    detail: "A recurring job in plain English — the Scheduler holds the cadence.",
    href: "/app/apps/rituals",
  },
  {
    slug: "invite_teammate",
    title: "Invite a teammate",
    detail: "Give someone a seat on a Persona. Solo on Personal Brain — skip it.",
    href: "/app/personas",
    skippableOnStarter: true,
  },
] as const;

export function getOnboardingStep(slug: OnboardingStepSlug): OnboardingStep {
  // The registry and the slug union are the same list; the find can't miss.
  return ONBOARDING_STEPS.find((s) => s.slug === slug) as OnboardingStep;
}

/** Credit bonus per completed step — Studio+/Enterprise only (PA-POS-30 gate holds). */
export const ONBOARDING_STEP_BONUS_CREDITS = 50;

/** Extra bonus when all six steps are complete — Studio+/Enterprise only. */
export const ONBOARDING_COMPLETION_BONUS_CREDITS = 250;
