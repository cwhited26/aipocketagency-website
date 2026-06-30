// constants.ts — shared enums for the Browser Automation lane (kept dependency-free so the pure
// modules + the DB layer share one source of truth, matching the migration's CHECK constraints).

/** Lifecycle of a pa_browser_actions row. Mirrors the migration's status CHECK. */
export const BROWSER_ACTION_STATUSES = [
  "refused",
  "blocked",
  "pending_approval",
  "executed",
  "rejected",
  "failed",
] as const;

export type BrowserActionStatus = (typeof BROWSER_ACTION_STATUSES)[number];

/** The Mission Control inbox kind a non-auto-approved tool call stages. */
export const BROWSER_ACTION_APPROVAL_KIND = "browser_action_approval" as const;

/** The cost-ledger feature slug for one executed browser action. */
export const BROWSER_COST_FEATURE_SLUG = "browser_action" as const;
