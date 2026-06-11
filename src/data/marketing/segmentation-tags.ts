// src/data/marketing/segmentation-tags.ts — the 25 webinar-funnel segmentation tags (Part 3E), the
// source of truth for any future Resend audience / list management. Authored once here so the email
// system, ad exports, and CRM sync all read the same canonical tag strings.

export type SegmentationTag = {
  /** The exact label used in the email/CRM system (Part 3E verbatim). */
  label: string;
  /** Coarse grouping for UI/reporting. */
  group: "lifecycle" | "engagement" | "purchase" | "activation";
};

export const SEGMENTATION_TAGS: readonly SegmentationTag[] = [
  { label: "Registered - Webinar", group: "lifecycle" },
  { label: "Attended - Webinar", group: "lifecycle" },
  { label: "Missed - Webinar", group: "lifecycle" },
  { label: "Clicked - Offer", group: "engagement" },
  { label: "Clicked - Pricing", group: "engagement" },
  { label: "Clicked - Idea Engine", group: "engagement" },
  { label: "Clicked - Lead Scout", group: "engagement" },
  { label: "Started Checkout", group: "engagement" },
  { label: "Purchased - Personal Brain", group: "purchase" },
  { label: "Purchased - Business Agent", group: "purchase" },
  { label: "Purchased - AI Agent Workspace", group: "purchase" },
  { label: "Purchased - Pro+", group: "purchase" },
  { label: "Purchased - Studio", group: "purchase" },
  { label: "Purchased - Enterprise", group: "purchase" },
  { label: "Purchased - Workflow Vault", group: "purchase" },
  { label: "Purchased - Premium DWY Setup", group: "purchase" },
  { label: "Purchased - Standard DWY Setup", group: "purchase" },
  { label: "Declined - DWY Setup", group: "purchase" },
  { label: "Purchased - 14-Day Pilot", group: "purchase" },
  { label: "Declined - Pilot", group: "purchase" },
  { label: "Purchased - DIY Kit", group: "purchase" },
  { label: "Joined - Launchpad", group: "activation" },
  { label: "Activated - 3-3-3", group: "activation" },
  { label: "Ran - Idea Engine", group: "activation" },
  { label: "Ran - Lead Scout", group: "activation" },
] as const;

export const SEGMENTATION_TAG_LABELS: readonly string[] = SEGMENTATION_TAGS.map((t) => t.label);
