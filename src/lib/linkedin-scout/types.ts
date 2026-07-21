// types.ts — LinkedIn Scout shared types + Zod schemas (Pocket_Agent_LinkedIn_Scout_SPEC_v1 §5).
//
// Pure data — no I/O. The data layer, enrichers, routes, and UI all read from here so the search
// params, the prospect row, the draft row, and the run row can never drift between layers. The Zod
// schemas validate the API boundary (search filters the owner submits, the shortlist selection); the
// row types mirror migration 111.

import { z } from "zod";

// ── Enrichment sources (SPEC §3, §4.1) ───────────────────────────────────────────────────────────

/** The paid APIs LinkedIn Scout enriches through — never a scraper (SPEC §3, §11). sales_nav is
 *  deferred: selecting it surfaces a "connect Sales Navigator" empty state rather than a live call. */
export const ENRICHMENT_SOURCES = ["apollo", "clay", "common_room", "sales_nav"] as const;
export type EnrichmentSource = (typeof ENRICHMENT_SOURCES)[number];

export function isEnrichmentSource(v: string): v is EnrichmentSource {
  return (ENRICHMENT_SOURCES as readonly string[]).includes(v);
}

/** Human label for a source, for the empty-state + provenance chips. */
export const ENRICHMENT_SOURCE_LABELS: Record<EnrichmentSource, string> = {
  apollo: "Apollo",
  clay: "Clay",
  common_room: "Common Room",
  sales_nav: "Sales Navigator",
};

// ── Draft kinds (SPEC §4.4) ──────────────────────────────────────────────────────────────────────

/** The three pieces of outreach LinkedIn Scout stages, each its own Approval Queue card. */
export const DRAFT_KINDS = ["connection_note", "day3_inmail", "day7_followup"] as const;
export type DraftKind = (typeof DRAFT_KINDS)[number];

export function isDraftKind(v: string): v is DraftKind {
  return (DRAFT_KINDS as readonly string[]).includes(v);
}

/** LinkedIn's hard cap on a connection-request note. Enforced on the connection_note draft (SPEC §4.4). */
export const CONNECTION_NOTE_MAX_CHARS = 300;

// ── Connection lifecycle ─────────────────────────────────────────────────────────────────────────

export const CONNECTION_STATUSES = ["pending", "sent", "accepted", "declined", "expired"] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

// ── Search params (the API boundary the owner submits) ───────────────────────────────────────────

/** The structured ICP picker + the free-text fallback (SPEC §4.1). All fields optional — a search can
 *  be pure free-text, pure structured, or a mix; the dispatcher maps whatever's present onto each
 *  connector's query shape. */
export const SearchParamsSchema = z.object({
  title: z.string().max(200).optional(),
  seniority: z.string().max(120).optional(),
  companySize: z.string().max(120).optional(),
  location: z.string().max(200).optional(),
  industry: z.string().max(200).optional(),
  keywords: z.string().max(400).optional(),
  /** Free-text ICP box — the fallback for anything the structured picker doesn't hit. */
  freeText: z.string().max(1_000).optional(),
  /** Which connected enrichment sources to run this search across. Empty = all configured sources. */
  sources: z.array(z.enum(ENRICHMENT_SOURCES)).max(4).optional(),
  /** Ceiling on candidates to return this run (the UI caps the slider; the route re-clamps). */
  limit: z.number().int().min(1).max(100).optional(),
});
export type SearchParams = z.infer<typeof SearchParamsSchema>;

/** The shortlist selection: which candidate profile URLs (from a completed search) to promote to
 *  prospects and kick research + drafts on. */
export const ShortlistSchema = z.object({
  runId: z.string().uuid(),
  /** The enrichment candidates the owner ticked — carried whole so we don't re-run the search. */
  candidates: z
    .array(
      z.object({
        linkedinProfileUrl: z.string().min(1).max(500),
        fullName: z.string().max(200).default(""),
        headline: z.string().max(400).default(""),
        company: z.string().max(200).default(""),
        fitScore: z.number().int().min(0).max(100).default(0),
        enrichmentSource: z.enum(ENRICHMENT_SOURCES),
        enrichmentSnapshot: z.record(z.string(), z.unknown()).default({}),
      }),
    )
    .min(1)
    .max(100),
});
export type ShortlistInput = z.infer<typeof ShortlistSchema>;

// ── Enrichment candidate (what a connector adapter returns) ──────────────────────────────────────

/** One person an enrichment adapter surfaced. Not yet a prospect — the owner shortlists a subset.
 *  `raw` is the adapter's untouched snapshot (stored on the prospect for the brief writer to read). */
export type EnrichmentCandidate = {
  linkedinProfileUrl: string;
  fullName: string;
  headline: string;
  company: string;
  /** Structured signals the fit-scorer reads: title, seniority, industry, companySize, recentMove,
   *  recentPost, mutualConnections. Plain strings/numbers so the scorer stays pure + testable. */
  signals: EnrichmentSignals;
  enrichmentSource: EnrichmentSource;
  raw: Record<string, unknown>;
};

/** The scoreable signals the fit-scorer reads off a candidate (SPEC §4.2). Every field optional —
 *  a sparse connector result still scores, just lower-confidence. */
export type EnrichmentSignals = {
  title?: string;
  seniority?: string;
  industry?: string;
  companySize?: string;
  location?: string;
  /** True when the profile shows a job change in the recent window (a warm outreach trigger). */
  recentJobMove?: boolean;
  /** True when the profile shows recent public posting activity. */
  recentPostActivity?: boolean;
  /** How many mutual connections the enrichment source reports. */
  mutualConnections?: number;
};

// ── Row shapes (mirror migration 111) ────────────────────────────────────────────────────────────

export type LinkedinScoutRun = {
  id: string;
  owner_id: string;
  search_params: SearchParams;
  candidate_count: number;
  shortlist_count: number;
  cost_usd: number;
  created_at: string;
};

export type LinkedinScoutProspect = {
  id: string;
  run_id: string;
  owner_id: string;
  linkedin_profile_url: string;
  full_name: string;
  headline: string;
  company: string;
  fit_score: number;
  enrichment_source: EnrichmentSource;
  enrichment_snapshot: Record<string, unknown>;
  brief: string;
  connection_status: ConnectionStatus;
  connection_sent_at: string | null;
  connection_accepted_at: string | null;
  day3_inmail_status: string;
  day7_followup_status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type LinkedinScoutDraft = {
  id: string;
  prospect_id: string;
  owner_id: string;
  kind: DraftKind;
  body: string;
  voice_flags: string;
  agent_pending_action_id: string | null;
  executed_at: string | null;
  created_at: string;
};
