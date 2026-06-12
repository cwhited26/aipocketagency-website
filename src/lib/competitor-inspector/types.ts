// types.ts — Competitor Inspector (recon Lane C, Phase 2). The App wraps one URL extraction in a
// competitor profile: the Design DNA block verbatim (SPEC §7.3 — same parser as standalone
// records) plus the Inspector's own wrapper fields, committed to the owner's brain at
// competitors/<source-slug>/profile.md behind a staged approval.

/** The in-process connector name the staged brain commit resolves through. */
export const BRAIN_CONNECTOR = "brain";

/** The one action v1 stages: commit a generated competitor profile to the owner's brain. */
export const COMMIT_PROFILE_ACTION = "commit_competitor_profile";

export const BRAIN_COMMIT_SCOPE = `${BRAIN_CONNECTOR}:${COMMIT_PROFILE_ACTION}`;

/** The staged approval payload — a reference, never the profile body (it lives on the run row). */
export type CommitProfilePayload = {
  extraction_id: string;
  profile_path: string;
  log_path: string;
  source_url: string;
};

export function commitProfilePayloadOf(payload: Record<string, unknown>): CommitProfilePayload | null {
  const extractionId = payload.extraction_id;
  const profilePath = payload.profile_path;
  const logPath = payload.log_path;
  const sourceUrl = payload.source_url;
  if (
    typeof extractionId !== "string" ||
    typeof profilePath !== "string" ||
    typeof logPath !== "string" ||
    typeof sourceUrl !== "string"
  ) {
    return null;
  }
  return { extraction_id: extractionId, profile_path: profilePath, log_path: logPath, source_url: sourceUrl };
}

/** The prose sections the profile body carries (SPEC §8.3, plus the Inspector's offer read). */
export type ProfileProse = {
  offer_summary: string;
  look_paragraph: string;
  distinctive: string[];
  borrow_skip: string;
};

export const COMPETITOR_PROFILE_DIR = "competitors";

export function profilePathFor(sourceSlug: string): string {
  return `${COMPETITOR_PROFILE_DIR}/${sourceSlug}/profile.md`;
}

export function extractionLogPathFor(sourceSlug: string): string {
  return `${COMPETITOR_PROFILE_DIR}/${sourceSlug}/extraction-log.md`;
}

export function screenshotPathFor(sourceSlug: string, name: string): string {
  return `${COMPETITOR_PROFILE_DIR}/${sourceSlug}/screenshots/${name}`;
}
