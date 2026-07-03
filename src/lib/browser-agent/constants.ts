// constants.ts — the Browser Agent App's fixed values in one place (PA-POS-19).
//
// The Browser Agent is the hosted-browser mission runner: Anthropic Computer Use plans one
// action at a time, Browserbase runs the browser, the cron worker advances jobs a few steps
// per tick, and every irreversible action stages a Mission Control card first.

export const BROWSER_AGENT_APP_ID = "browser-agent";

/** Connector name used when staging approval cards through the orchestrator plumbing. */
export const BROWSER_AGENT_CONNECTOR = "browser_agent";
/** The single staged action: "run this held browser step after the owner approves". */
export const BROWSER_AGENT_APPROVAL_ACTION = "job_step";

export const BROWSER_AGENT_COST_FEATURE_SLUG = "browser_agent" as const;

/** Private Storage bucket; object paths are <owner_id>/<job_id>/<step>.png. */
export const BROWSER_AGENT_SCREENSHOT_BUCKET = "pa-browser-screenshots";

/**
 * The Computer Use model. claude-sonnet-4-6 is the latest Sonnet wired in this repo
 * (chat + proposals + channels all run it) and supports the computer_20250124 tool with the
 * computer-use-2025-01-24 beta header.
 */
export const BROWSER_AGENT_MODEL = "claude-sonnet-4-6";
export const COMPUTER_USE_BETA_HEADER = "computer-use-2025-01-24";

/** Anthropic-recommended XGA viewport for Computer Use accuracy. */
export const BROWSER_VIEWPORT = { width: 1024, height: 768 } as const;

export const JOB_STATUSES = [
  "queued",
  "running",
  "awaiting_approval",
  "completed",
  "failed",
  "canceled",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const TERMINAL_JOB_STATUSES: readonly JobStatus[] = ["completed", "failed", "canceled"];

export const STEP_ACTION_KINDS = [
  "click",
  "type",
  "key",
  "screenshot",
  "navigate",
  "scroll",
  "wait",
  "awaiting_approval",
] as const;
export type StepActionKind = (typeof STEP_ACTION_KINDS)[number];

// ── Per-job defaults (owner can lower them in the New Job form; tier caps the ceiling) ──
export const DEFAULT_MAX_STEPS = 50;
export const DEFAULT_MAX_WALL_SECONDS = 1800;
/** Micro-cents (1 USD = 1,000,000). 5,000,000 = $5.00 hard cap per job. */
export const DEFAULT_MAX_COST_MICRO_CENTS = 5_000_000;

// ── Worker pacing ────────────────────────────────────────────────────────────────────────
/** Jobs one cron tick will pick up. */
export const WORKER_JOBS_PER_TICK = 3;
/** Steps one tick may advance a single job (keeps ticks short; the next tick continues). */
export const WORKER_STEPS_PER_TICK = 6;
/** Per-job wall budget inside one tick, ms. */
export const WORKER_JOB_TICK_BUDGET_MS = 70_000;
/** Lease horizon a tick claims; an expired lease means the prior tick died mid-job. */
export const WORKER_LEASE_SECONDS = 240;

/** How many recent screenshots stay in the Computer Use conversation as images. */
export const CONVERSATION_SCREENSHOTS_KEPT = 3;
