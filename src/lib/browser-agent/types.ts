// types.ts — Zod boundary schemas + row shapes for the Browser Agent App. Every payload that
// crosses a boundary (job creation body, cron worker state, Computer Use tool input, approval
// callback payload) parses through here — malformed input never reaches the browser.

import { z } from "zod";
import {
  DEFAULT_MAX_COST_MICRO_CENTS,
  DEFAULT_MAX_STEPS,
  DEFAULT_MAX_WALL_SECONDS,
  JOB_STATUSES,
  STEP_ACTION_KINDS,
  type JobStatus,
  type StepActionKind,
} from "./constants";

// ── Anthropic message shapes (direct REST — typed minimally, never `any`) ────────────────

export type AnthropicImageSource = {
  type: "base64";
  media_type: "image/png";
  data: string;
};

export type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: AnthropicImageSource }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | {
      type: "tool_result";
      tool_use_id: string;
      is_error?: boolean;
      content: Array<
        { type: "text"; text: string } | { type: "image"; source: AnthropicImageSource }
      >;
    };

export type AnthropicMessage = {
  role: "user" | "assistant";
  content: AnthropicContentBlock[];
};

export type AnthropicUsage = { input_tokens: number; output_tokens: number };

// ── Computer Use tool input (what the model sends back inside a tool_use block) ─────────

export const ComputerActionSchema = z.object({
  action: z.string().min(1),
  coordinate: z.tuple([z.number(), z.number()]).optional(),
  start_coordinate: z.tuple([z.number(), z.number()]).optional(),
  text: z.string().optional(),
  scroll_direction: z.enum(["up", "down", "left", "right"]).optional(),
  scroll_amount: z.number().optional(),
  duration: z.number().optional(),
});
export type ComputerAction = z.infer<typeof ComputerActionSchema>;

export const NavigateInputSchema = z.object({
  url: z.string().url().max(2_000),
});

// ── Planned action — the normalized shape the approval gate + driver both consume ───────

export type PlannedAction =
  | { kind: "screenshot" }
  | { kind: "click"; x: number; y: number; clickCount: 1 | 2 | 3; button: "left" | "right" }
  | { kind: "type"; text: string }
  | { kind: "key"; text: string }
  | { kind: "scroll"; x: number; y: number; direction: "up" | "down" | "left" | "right"; amount: number }
  | { kind: "wait"; seconds: number }
  | { kind: "navigate"; url: string };

/** What sits under the cursor — the approval gate classifies on this, never on raw pixels. */
export type ElementInfo = {
  tag: string;
  inputType: string | null;
  role: string | null;
  text: string;
  ariaLabel: string | null;
  href: string | null;
  inForm: boolean;
  isPasswordField: boolean;
  autocomplete: string | null;
};

// ── Job state carried between cron ticks (state_json) ───────────────────────────────────

export type BrowserJobState = {
  messages: AnthropicMessage[];
  browserbase: { sessionId: string; connectUrl: string } | null;
  /** Browserbase seconds accrued so far (for the cost estimate). */
  browserSecondsAccrued: number;
};

export const EMPTY_JOB_STATE: BrowserJobState = {
  messages: [],
  browserbase: null,
  browserSecondsAccrued: 0,
};

/** The held step recorded on pending_step while a card waits in Mission Control. */
export const PendingStepSchema = z.object({
  stepNumber: z.number().int().min(1),
  inboxItemId: z.string().min(1),
  toolUseId: z.string().min(1),
  action: z.record(z.string(), z.unknown()),
  reasoning: z.string(),
});
export type PendingStep = z.infer<typeof PendingStepSchema>;

// ── Rows (PostgREST snake_case) ──────────────────────────────────────────────────────────

export const BrowserJobRowSchema = z.object({
  id: z.string(),
  owner_id: z.string(),
  workspace_id: z.string().nullable(),
  agent_persona_id: z.string().nullable(),
  intent: z.string(),
  starting_url: z.string(),
  status: z.enum(JOB_STATUSES),
  current_step: z.number().int(),
  max_steps: z.number().int(),
  max_wall_seconds: z.number().int(),
  max_cost_micro_cents: z.number().int(),
  cost_micro_cents_estimate: z.number().int(),
  state_json: z.unknown(),
  browserbase_session_id: z.string().nullable(),
  pending_step: z.unknown().nullable(),
  gate_findings: z.unknown().nullable(),
  result_summary: z.string().nullable(),
  error: z.string().nullable(),
  // How the job was entitled at creation (PA-POS-31): the owner's tier or a Project Pass.
  // Defaulted so rows written before migration 100 parse unchanged.
  entitlement_source: z.enum(["tier", "project_pass"]).default("tier"),
  lease_until: z.string().nullable(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type BrowserJobRow = z.infer<typeof BrowserJobRowSchema>;

export const BrowserStepRowSchema = z.object({
  id: z.string(),
  job_id: z.string(),
  owner_id: z.string(),
  step_number: z.number().int(),
  action_kind: z.enum(STEP_ACTION_KINDS),
  action_payload: z.record(z.string(), z.unknown()),
  screenshot_path: z.string().nullable(),
  reasoning: z.string().nullable(),
  inbox_item_id: z.string().nullable(),
  approval_status: z.enum(["pending", "approved", "rejected"]).nullable(),
  created_at: z.string(),
});
export type BrowserStepRow = z.infer<typeof BrowserStepRowSchema>;

// ── API boundaries ───────────────────────────────────────────────────────────────────────

export const CreateJobBodySchema = z.object({
  intent: z.string().min(8).max(2_000),
  startingUrl: z.string().url().max(2_000),
  agentPersonaId: z.string().uuid().nullable().optional().default(null),
  maxSteps: z.number().int().min(3).max(500).optional().default(DEFAULT_MAX_STEPS),
  maxWallSeconds: z.number().int().min(60).max(7_200).optional().default(DEFAULT_MAX_WALL_SECONDS),
  maxCostCents: z
    .number()
    .int()
    .min(25)
    .max(10_000)
    .optional()
    .default(DEFAULT_MAX_COST_MICRO_CENTS / 10_000),
});
export type CreateJobBody = z.infer<typeof CreateJobBodySchema>;

export function parseJobState(raw: unknown): BrowserJobState {
  if (!raw || typeof raw !== "object") return { ...EMPTY_JOB_STATE, messages: [] };
  const obj = raw as Partial<BrowserJobState>;
  return {
    messages: Array.isArray(obj.messages) ? (obj.messages as AnthropicMessage[]) : [],
    browserbase:
      obj.browserbase && typeof obj.browserbase === "object" &&
      typeof (obj.browserbase as { sessionId?: unknown }).sessionId === "string" &&
      typeof (obj.browserbase as { connectUrl?: unknown }).connectUrl === "string"
        ? (obj.browserbase as { sessionId: string; connectUrl: string })
        : null,
    browserSecondsAccrued:
      typeof obj.browserSecondsAccrued === "number" && Number.isFinite(obj.browserSecondsAccrued)
        ? obj.browserSecondsAccrued
        : 0,
  };
}

export function isTerminalStatus(status: JobStatus): boolean {
  return status === "completed" || status === "failed" || status === "canceled";
}

/** Maps a planned action to the step timeline's action_kind. */
export function actionKindOf(action: PlannedAction): StepActionKind {
  return action.kind;
}
