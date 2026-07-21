// fitscore.ts — the 0-100 ICP fit scorer (Pocket_Agent_LinkedIn_Scout_SPEC_v1 §4.2).
//
// Pure + deterministic so it unit-tests without a network (fitscore.test.ts). It scores an enrichment
// candidate's signals against the ICP the owner searched for — the structured picker fields plus any
// free-text — using token overlap for the text matches and simple bonuses for the momentum signals.
//
// Signal weights (SPEC §4.2): title match is the headline signal, then industry, company size, and
// seniority. Recent job move, recent post activity, and mutual connections are additive bonuses — a
// warm reason to reach out now — never the core of the score. The result clamps to 0..100.

import type { EnrichmentSignals, SearchParams } from "./types";

/** The ICP the scorer matches against — the target values the owner searched for. Built from the
 *  structured picker fields plus the free-text/keywords box (tokenized so a phrase still contributes). */
export type IcpTarget = {
  title: string[];
  seniority: string[];
  industry: string[];
  companySize: string[];
  /** Everything else worth matching — free-text + keywords, tokenized. */
  keywords: string[];
};

// Weights sum to 80 for the core signal match; the three bonuses add up to 20, so a perfect candidate
// with every momentum signal reaches 100 and a pure-signal match tops out at 80 (SPEC §4.2 — momentum
// is a bonus, never the core).
const WEIGHT_TITLE = 35;
const WEIGHT_INDUSTRY = 20;
const WEIGHT_COMPANY_SIZE = 15;
const WEIGHT_SENIORITY = 10;

const BONUS_RECENT_MOVE = 8;
const BONUS_RECENT_POST = 6;
const BONUS_MUTUALS_MAX = 6;
// Mutual-connection bonus saturates: this many mutuals earns the full BONUS_MUTUALS_MAX.
const MUTUALS_SATURATION = 5;

const TOKEN_SPLIT = /[^a-z0-9+]+/i;

/** Lowercase word tokens of a string, dropping empties + one-char noise. */
function tokenize(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw
    .toLowerCase()
    .split(TOKEN_SPLIT)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);
}

/** Build the ICP target from the search the owner ran (SPEC §4.1 → §4.2). Free-text + keywords fold
 *  into `keywords` so a candidate whose title contains a free-text term still gets partial credit. */
export function icpFromSearch(params: SearchParams): IcpTarget {
  return {
    title: tokenize(params.title),
    seniority: tokenize(params.seniority),
    industry: tokenize(params.industry),
    companySize: tokenize(params.companySize),
    keywords: [...tokenize(params.keywords), ...tokenize(params.freeText)],
  };
}

/** Fraction (0..1) of the candidate field's tokens that overlap the target's — the text-match signal.
 *  When the owner didn't specify a target for this field, it's a neutral 0 (no signal, no penalty). */
function overlap(targetTokens: string[], candidateField: string | undefined): number {
  if (targetTokens.length === 0) return 0;
  const cand = new Set(tokenize(candidateField));
  if (cand.size === 0) return 0;
  let hits = 0;
  for (const t of targetTokens) {
    if (cand.has(t)) hits += 1;
  }
  return hits / targetTokens.length;
}

/** True when the owner supplied no structured ICP at all (pure free-text or empty search) — the core
 *  weighted match has nothing to bite on, so the scorer leans on keyword overlap instead. */
function hasNoStructuredTarget(icp: IcpTarget): boolean {
  return (
    icp.title.length === 0 &&
    icp.industry.length === 0 &&
    icp.companySize.length === 0 &&
    icp.seniority.length === 0
  );
}

/**
 * Score one candidate's signals against the ICP, 0..100. Deterministic — same inputs, same score.
 * When the owner ran a pure free-text search (no structured fields), the keyword overlap against the
 * candidate's title + industry stands in for the core match so the score still discriminates.
 */
export function scoreFit(signals: EnrichmentSignals, icp: IcpTarget): number {
  let core = 0;

  if (hasNoStructuredTarget(icp)) {
    // Free-text-only search: match keywords against the candidate's title + industry, scaled to the
    // full core weight so a strong keyword hit can still reach a high score.
    const titleHit = overlap(icp.keywords, signals.title);
    const industryHit = overlap(icp.keywords, signals.industry);
    core = (Math.max(titleHit, industryHit) * (WEIGHT_TITLE + WEIGHT_INDUSTRY)) +
      (Math.min(titleHit, industryHit) * (WEIGHT_COMPANY_SIZE + WEIGHT_SENIORITY));
  } else {
    core += overlap(icp.title, signals.title) * WEIGHT_TITLE;
    core += overlap(icp.industry, signals.industry) * WEIGHT_INDUSTRY;
    core += overlap(icp.companySize, signals.companySize) * WEIGHT_COMPANY_SIZE;
    core += overlap(icp.seniority, signals.seniority) * WEIGHT_SENIORITY;
    // Keyword overlap against the title is a small extra nudge on top of the structured match.
    core += overlap(icp.keywords, signals.title) * 5;
  }

  let bonus = 0;
  if (signals.recentJobMove) bonus += BONUS_RECENT_MOVE;
  if (signals.recentPostActivity) bonus += BONUS_RECENT_POST;
  if (typeof signals.mutualConnections === "number" && signals.mutualConnections > 0) {
    const ratio = Math.min(signals.mutualConnections, MUTUALS_SATURATION) / MUTUALS_SATURATION;
    bonus += ratio * BONUS_MUTUALS_MAX;
  }

  const total = core + bonus;
  return Math.max(0, Math.min(100, Math.round(total)));
}

/** A short, honest label for a score band — used on the shortlist chip so the owner reads fit at a
 *  glance without a number-only display. */
export function fitBand(score: number): "strong" | "worth-a-look" | "weak" {
  if (score >= 70) return "strong";
  if (score >= 40) return "worth-a-look";
  return "weak";
}
