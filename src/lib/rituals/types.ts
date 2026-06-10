// types.ts — the Ritual Scheduler shared types + pure constants (no I/O).
//
// A ritual is (when, what, deliver): a natural-language schedule the owner typed (parsed to cron, the
// raw cron never shown back), a target App (or a saved Project Plan), and where the result lands — a
// Mission Control card by default, or an email digest. This module holds the row shapes the data
// layer, the run executor, the cron, the API routes, and the client all share, plus the small pure
// helpers (delivery labels, the run-status copy) that carry no network or DB dependency.

// ── Delivery ─────────────────────────────────────────────────────────────────────

/** Where a ritual's result lands (SPEC §4.1). 'inbox' stages a Mission Control card; 'email_digest'
 *  also packages the card body and emails it to the owner. */
export type RitualDelivery = "inbox" | "email_digest";

export const RITUAL_DELIVERIES: readonly RitualDelivery[] = ["inbox", "email_digest"] as const;

export function isRitualDelivery(value: string): value is RitualDelivery {
  return (RITUAL_DELIVERIES as readonly string[]).includes(value);
}

/** The terminal status of one ritual fire. */
export type RitualLastRunStatus = "success" | "failed";

/** The status of a pa_ritual_runs row across its lifecycle. */
export type RitualRunStatus = "running" | "success" | "failed";

// ── Row shapes (mirror migration 072) ─────────────────────────────────────────────

/** One pa_rituals row. Exactly one of app_slug / project_plan_id is set (the table CHECK enforces it). */
export type Ritual = {
  id: string;
  owner_id: string;
  name: string;
  app_slug: string | null;
  app_payload: Record<string, unknown>;
  project_plan_id: string | null;
  schedule_cron: string;
  schedule_natural_text: string;
  bi_weekly_skip: boolean;
  delivery: RitualDelivery;
  enabled: boolean;
  next_run_at: string;
  last_run_at: string | null;
  last_run_status: RitualLastRunStatus | null;
  consecutive_failures: number;
  created_at: string;
  updated_at: string;
};

/** One pa_ritual_runs row — the per-fire log. */
export type RitualRun = {
  id: string;
  ritual_id: string;
  started_at: string;
  finished_at: string | null;
  status: RitualRunStatus;
  result_card_id: string | null;
  error_text: string | null;
  cost_micro_cents: number;
  created_at: string;
};

// ── Failure backoff (PA-RITUAL-6) ─────────────────────────────────────────────────

/** After this many consecutive failures a ritual auto-pauses and stages a ritual_paused card. Mirrors
 *  the Podcast Watch feed-error backoff. */
export const RITUAL_MAX_CONSECUTIVE_FAILURES = 5;
