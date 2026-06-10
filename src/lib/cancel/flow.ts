// lib/cancel/flow.ts — the data model for the /cancel save flow (Part 5J). The 9 cancellation reasons,
// the 4 save options, and the reason→option mapping, shared by the pages and the API route validation.

export type CancelReason = {
  slug: string;
  label: string;
  /** Which save option to show for this reason. */
  option: SaveOptionKey;
};

export type SaveOptionKey = "did-not-set-up" | "too-expensive" | "bad-output" | "technical-issue";

export const CANCEL_REASONS: CancelReason[] = [
  { slug: "did-not-set-up", label: "I did not set it up.", option: "did-not-set-up" },
  { slug: "did-not-understand", label: "I did not understand what to do first.", option: "did-not-set-up" },
  { slug: "need-lower-plan", label: "I need a lower plan.", option: "too-expensive" },
  { slug: "hit-usage-limits", label: "I hit usage limits.", option: "too-expensive" },
  { slug: "do-not-need-now", label: "I do not need it right now.", option: "did-not-set-up" },
  { slug: "technical-issue", label: "I had a technical issue.", option: "technical-issue" },
  { slug: "bad-output", label: "It did not produce good output.", option: "bad-output" },
  { slug: "too-expensive", label: "It is too expensive.", option: "too-expensive" },
  { slug: "other", label: "Other.", option: "did-not-set-up" },
];

export function reasonBySlug(slug: string): CancelReason | null {
  return CANCEL_REASONS.find((r) => r.slug === slug) ?? null;
}

export function isCancelReasonSlug(slug: string): boolean {
  return CANCEL_REASONS.some((r) => r.slug === slug);
}

export type SaveOption = {
  key: SaveOptionKey;
  headline: string;
  copy: string[];
  cta: { label: string; href: string };
  secondaryLabel: string;
};

// In-app deep-links for the save CTAs. Relative so they resolve on whichever host serves /cancel.
export const SAVE_OPTIONS: Record<SaveOptionKey, SaveOption> = {
  "did-not-set-up": {
    key: "did-not-set-up",
    headline: "You may not need to cancel. You may need activation help.",
    copy: [
      "Most users do not fail because Pocket Agent cannot help. They fail because they never complete the setup.",
      "Your first milestone is: 3 Business Brain assets. 3 trained Personas. 3 working workflows.",
      "Complete the Launch Kit's 7-day setup steps. If you do not have 3 trained Personas and 3 working workflows inside Pocket Agent by day 7, we help you finish the setup.",
    ],
    cta: { label: "Get Setup Help", href: "/app/launch-kit" },
    secondaryLabel: "Cancel Anyway",
  },
  "too-expensive": {
    key: "too-expensive",
    headline: "Want to switch to a lower plan?",
    copy: [
      "If you are not ready for your current plan, downgrade instead of canceling.",
      "Options: AI Agent Workspace to Business Agent. Business Agent to Personal Brain.",
      "Personal Brain keeps your single brain active. Business Agent keeps your core Personas, Apps, and Mission Control.",
    ],
    cta: { label: "Downgrade My Plan", href: "/pricing" },
    secondaryLabel: "Cancel Anyway",
  },
  "bad-output": {
    key: "bad-output",
    headline: "Bad output usually means missing context.",
    copy: [
      "If the output felt generic, your Business Brain may need more context.",
      "Add: Better voice samples. Clearer offer details. Customer questions. Follow-up examples. Do-not-say list. Workflow rules.",
      "Pocket Agent can only use the context it has.",
    ],
    cta: { label: "Improve My Business Brain", href: "/app/documents" },
    secondaryLabel: "Cancel Anyway",
  },
  "technical-issue": {
    key: "technical-issue",
    headline: "Let us look at the issue first.",
    copy: [
      "If you had a technical issue, report it before canceling.",
      "Use this format: Issue. Expected behavior. Actual behavior. App or page. Screenshot or screen recording.",
    ],
    cta: { label: "Report Issue", href: "mailto:chase@aipocketagent.com?subject=Pocket%20Agent%20technical%20issue" },
    secondaryLabel: "Cancel Anyway",
  },
};

export const CANCEL_HEADLINE = "Before you cancel, what happened?";
