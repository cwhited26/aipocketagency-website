// views.ts — row → client-view projections shared by the Browser Agent routes and pages
// (route files can only export handlers, so the shapes live here).

import { formatMicroCentsUsd } from "./cost";
import type { BrowserJobRow, BrowserStepRow } from "./types";

export type JobListView = {
  id: string;
  intent: string;
  startingUrl: string;
  status: string;
  currentStep: number;
  maxSteps: number;
  costUsd: string;
  error: string | null;
  resultSummary: string | null;
  createdAt: string;
};

export function toJobListView(row: BrowserJobRow): JobListView {
  return {
    id: row.id,
    intent: row.intent,
    startingUrl: row.starting_url,
    status: row.status,
    currentStep: row.current_step,
    maxSteps: row.max_steps,
    costUsd: formatMicroCentsUsd(row.cost_micro_cents_estimate),
    error: row.error,
    resultSummary: row.result_summary,
    createdAt: row.created_at,
  };
}

export type StepView = {
  stepNumber: number;
  actionKind: string;
  actionPayload: Record<string, unknown>;
  reasoning: string | null;
  screenshotUrl: string | null;
  inboxItemId: string | null;
  approvalStatus: string | null;
  createdAt: string;
};

export function toStepView(row: BrowserStepRow, screenshotUrl: string | null): StepView {
  return {
    stepNumber: row.step_number,
    actionKind: row.action_kind,
    actionPayload: row.action_payload,
    reasoning: row.reasoning,
    screenshotUrl,
    inboxItemId: row.inbox_item_id,
    approvalStatus: row.approval_status,
    createdAt: row.created_at,
  };
}

export type JobDetailView = JobListView & {
  maxWallSeconds: number;
  costCapUsd: string;
  startedAt: string | null;
  completedAt: string | null;
  steps: StepView[];
};

export function toJobDetailView(row: BrowserJobRow, steps: StepView[]): JobDetailView {
  return {
    ...toJobListView(row),
    maxWallSeconds: row.max_wall_seconds,
    costCapUsd: formatMicroCentsUsd(row.max_cost_micro_cents),
    startedAt: row.started_at,
    completedAt: row.completed_at,
    steps,
  };
}
