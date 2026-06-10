// steps.ts — the interactive Launch Kit checklist (PA-LAUNCHKIT-IMPL-1).
//
// The Launch Kit page renders these as checkboxes wired to per-step progress (pa_launch_kit_progress).
// The prose content lives in markdown (src/data/launch-kit/); these structured steps are the trackable
// items with a deep link into the surface where each is done. Pure data — no I/O.

export type LaunchKitStep = {
  slug: string;
  label: string;
  blurb: string;
  // Where the owner goes to complete the step.
  ctaHref: string;
  ctaLabel: string;
};

export type LaunchKitSection = {
  key: string;
  title: string;
  steps: LaunchKitStep[];
};

// The seven Business Brain items + the milestones that mark the workspace as running. step_slug values
// are stable strings — renaming one orphans existing progress rows, so treat them as identifiers.
export const LAUNCH_KIT_SECTIONS: LaunchKitSection[] = [
  {
    key: "brain",
    title: "Set up your Business Brain",
    steps: [
      {
        slug: "brain-offers",
        label: "Add your offers",
        blurb: "What you sell and what it costs — what the agents quote and point people toward.",
        ctaHref: "/app/documents",
        ctaLabel: "Add offers",
      },
      {
        slug: "brain-services",
        label: "Add your services",
        blurb: "Each service with a plain description of what's included.",
        ctaHref: "/app/documents",
        ctaLabel: "Add services",
      },
      {
        slug: "brain-faqs",
        label: "Add your FAQs",
        blurb: "The questions you answer over and over, so the agents handle them in your words.",
        ctaHref: "/app/documents",
        ctaLabel: "Add FAQs",
      },
      {
        slug: "brain-voice",
        label: "Add your brand voice",
        blurb: "A few real emails or posts you've written, so drafts sound like you.",
        ctaHref: "/app/documents",
        ctaLabel: "Add voice samples",
      },
      {
        slug: "brain-customers",
        label: "Add your customer notes",
        blurb: "Who you work with and what to remember before a follow-up.",
        ctaHref: "/app/documents",
        ctaLabel: "Add customer notes",
      },
      {
        slug: "brain-sales-materials",
        label: "Add your sales materials",
        blurb: "Proposals, one-pagers, decks — your real language and proof points.",
        ctaHref: "/app/documents",
        ctaLabel: "Add materials",
      },
      {
        slug: "brain-past-prompts",
        label: "Add your standard instructions",
        blurb: "The directions you repeat — how you sign off, what to never say, your process.",
        ctaHref: "/app/documents",
        ctaLabel: "Add instructions",
      },
    ],
  },
  {
    key: "running",
    title: "Get the workspace running",
    steps: [
      {
        slug: "personas-confirmed",
        label: "Meet your 3 starter Personas",
        blurb: "Admin Assistant, Sales Follow-Up Agent, and Content Creator come pre-installed.",
        ctaHref: "/app/personas",
        ctaLabel: "View Personas",
      },
      {
        slug: "first-workflow",
        label: "Run a starter workflow",
        blurb: "Your plan comes with workflows already installed — run one and approve the draft.",
        ctaHref: "/app/apps/workflow-vault",
        ctaLabel: "Open the Vault",
      },
      {
        slug: "first-output",
        label: "Get your first real output",
        blurb: "Put a Persona to work and read the first draft it brings back.",
        ctaHref: "/app/ask",
        ctaLabel: "Ask your agent",
      },
      {
        slug: "first-review",
        label: "Read your first Mission Control review",
        blurb: "Walk the cockpit — what ran, what's staged for approval, what it cost.",
        ctaHref: "/app",
        ctaLabel: "Open Mission Control",
      },
      {
        slug: "first-routine",
        label: "Turn on a routine",
        blurb: "Let a workflow run on a schedule — a daily brief, a weekly sweep.",
        ctaHref: "/app/routines",
        ctaLabel: "Turn on a routine",
      },
    ],
  },
];

export const LAUNCH_KIT_STEPS: LaunchKitStep[] = LAUNCH_KIT_SECTIONS.flatMap((s) => s.steps);

export function isLaunchKitStepSlug(slug: string): boolean {
  return LAUNCH_KIT_STEPS.some((s) => s.slug === slug);
}

/** Total trackable steps — used to render the progress count. */
export const LAUNCH_KIT_STEP_COUNT = LAUNCH_KIT_STEPS.length;

export const IMPLEMENTATION_GUARANTEE =
  "Complete the 7-day checklist or Pocket Agent helps you finish.";
