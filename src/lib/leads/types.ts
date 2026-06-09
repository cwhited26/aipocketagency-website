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
export type LeadScoutSourceKind = "url_list" | "google_maps";

/**
 * The filters a Google Maps sweep applies to each business listing (Phase 2). `noWebsite` is the
 * headline (PA-LS-9): keep only listings with no real website — a Facebook/Instagram page is not a
 * website. The rest narrow on review volume and reachability.
 */
export type MapsSweepFilters = {
  /** Keep only listings without a real website — the Facebook-guy use case. Defaults on. */
  noWebsite: boolean;
  /** Drop listings under this many reviews (null = no floor). */
  minReviews: number | null;
  /** Drop listings over this many reviews (null = no ceiling). */
  maxReviews: number | null;
  /** Keep only listings that publish a phone number. */
  hasPhone: boolean;
  /** Keep only listings that publish an email. */
  hasEmail: boolean;
};

/** A saved Google Maps sweep's criteria — what a `google_maps` source stores in config_json. */
export type MapsSweepConfig = {
  /** Business category — "roofing", "HVAC", "med spa", … */
  category: string;
  /** Where to look — "Knoxville, TN". */
  location: string;
  /** Search radius in miles (approximate — Google ranks by proximity). */
  radiusMiles: number;
  filters: MapsSweepFilters;
};

export function emptyMapsFilters(): MapsSweepFilters {
  return { noWebsite: true, minReviews: null, maxReviews: null, hasPhone: false, hasEmail: false };
}

export type LeadScoutSource = {
  id: string;
  owner_id: string;
  project_id: string | null;
  name: string;
  kind: LeadScoutSourceKind;
  extraction_pattern: string;
  seed_urls: string[];
  /** Sweep criteria for a google_maps source; null for url_list. */
  config_json: MapsSweepConfig | null;
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
  /** Null until the Email Drafter has staged an outreach draft for this lead (Phase 3, idempotency). */
  outreach_drafted_at: string | null;
  created_at: string;
};

export function emptyBreakdown(): LeadBreakdown {
  return { hot: 0, warm: 0, cold: 0, wrong_fit: 0, needs_research: 0 };
}

/** Per-batch volume ceiling (PA-LS / SPEC volume caps): 200 URLs on free, 2000 on paid. */
export function batchUrlCap(isPaid: boolean): number {
  return isPaid ? 2000 : 200;
}

/**
 * Per-run Google Maps lead ceiling by tier (PA-LS-6 / SPEC §6): Free 25 / Pro 250 / Studio 2,500 /
 * Studio+ 10,000. Pro+ rides the Pro number; Enterprise rides the Studio+ number. The cap is hard —
 * the sweep stops collecting at the line and surfaces the rest as skipped, never a silent trueup.
 */
export function mapsSweepCap(tier: string): number {
  switch (tier) {
    case "starter":
      return 25;
    case "pro":
    case "pro_plus":
      return 250;
    case "studio":
      return 2500;
    case "studio_plus":
    case "enterprise":
      return 10000;
    default:
      return 25;
  }
}
