// Shared Lead Scout types — the data model the orchestrator, routes, and UI all read from.

export type LeadClassification = "hot" | "warm" | "cold" | "wrong_fit" | "needs_research";

export const LEAD_CLASSIFICATIONS: readonly LeadClassification[] = [
  "hot",
  "warm",
  "cold",
  "wrong_fit",
  "needs_research",
] as const;

export type LeadScoutSchedule = "on_demand" | "daily" | "weekly";
export type LeadScoutSourceKind = "url_list";

export type LeadScoutSource = {
  id: string;
  owner_id: string;
  project_id: string | null;
  name: string;
  kind: LeadScoutSourceKind;
  extraction_pattern: string;
  seed_urls: string[];
  schedule: LeadScoutSchedule;
  created_at: string;
  updated_at: string;
};

export type LeadScoutRunStatus = "queued" | "running" | "completed" | "failed";

/** The classification tally a finished run carries — one count per bucket. */
export type LeadBreakdown = Record<LeadClassification, number>;

/** A URL that tripped the denylist on a run (PA-LS-5) — logged, not silently dropped. */
export type ConfigWarning = { url: string; reason: string };

export type LeadScoutRun = {
  id: string;
  source_id: string;
  owner_id: string;
  status: LeadScoutRunStatus;
  url_count: number;
  lead_count: number;
  breakdown: LeadBreakdown;
  config_warnings: ConfigWarning[];
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

export type LeadScoutLead = {
  id: string;
  run_id: string;
  source_id: string;
  owner_id: string;
  url: string;
  domain: string;
  name: string;
  contact: string;
  summary: string;
  profile: Record<string, unknown>;
  classification: LeadClassification;
  brain_path: string | null;
  status: "extracted" | "failed";
  error: string | null;
  created_at: string;
};

export function emptyBreakdown(): LeadBreakdown {
  return { hot: 0, warm: 0, cold: 0, wrong_fit: 0, needs_research: 0 };
}

/** Per-batch volume ceiling (PA-LS / SPEC volume caps): 200 URLs on free, 2000 on paid. */
export function batchUrlCap(isPaid: boolean): number {
  return isPaid ? 2000 : 200;
}
