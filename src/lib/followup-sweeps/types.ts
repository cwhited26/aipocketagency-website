// types.ts — the Follow-Up Sweeps domain model (PA-FUS-1..6).
//
// Follow-Up Sweeps watches dormant contacts across three sources and drafts the next touch in the
// owner's voice. The shape of a watch (a "source"), the people it has seen (a "contact"), and the
// tone each relationship gets are all declared here so the discover / draft / sweep modules and the
// API routes read one vocabulary. Pure types + constants, no I/O.

/** The discovery backend a source reads from. */
export type FollowupSourceType = "gmail" | "brain_customer" | "lead_scout";

/**
 * The relationship category a source watches. It drives two things: the default dormancy threshold
 * (how long is "too long" before a follow-up) and the tone of the draft (PA-FUS-2). A cold lead gets
 * a warm reactivation; an active customer gets a check-in; a past customer gets a deeper reactivation.
 */
export type FollowupRelationship = "cold_lead" | "active_customer" | "past_customer";

/** Per-source configuration. The relationship is required; the rest are per-source-type knobs. */
export type FollowupSourceConfig = {
  /** Human label shown on the dashboard and the batch card ("Knoxville cold leads"). */
  label: string;
  /** Relationship category — drives the tone (PA-FUS-2) and the default dormancy threshold. */
  relationship: FollowupRelationship;
  /** brain_customer only — the brain directory of customer files to scan. Defaults to "customers". */
  brainDir?: string;
};

export type FollowupSweepSource = {
  id: string;
  owner_id: string;
  source_type: FollowupSourceType;
  source_config: FollowupSourceConfig;
  dormancy_days: number;
  enabled: boolean;
  last_swept_at: string | null;
  next_sweep_at: string | null;
  created_at: string;
  updated_at: string;
};

export type FollowupSweepContact = {
  id: string;
  owner_id: string;
  source_id: string;
  contact_email: string;
  contact_name: string | null;
  last_touched_at: string | null;
  suppressed: boolean;
  last_drafted_at: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * A dormant contact a discovery backend surfaced, before it's persisted. `note` is a compact line of
 * facts (last touch date, what the source knows about them) the drafter folds into the email's key
 * points — never invented, always sourced from the discovery backend.
 */
export type DiscoveredContact = {
  contactEmail: string;
  contactName: string | null;
  /** ISO timestamp of the most recent touch the backend found, or null when it can't date it. */
  lastTouchedAt: string | null;
  note: string;
};

/** PA-FUS-1 default dormancy thresholds, by relationship. The owner can override per source. */
export const DEFAULT_DORMANCY_DAYS: Record<FollowupRelationship, number> = {
  cold_lead: 14,
  active_customer: 30,
  past_customer: 60,
};

/**
 * PA-FUS-3: never re-draft the same contact within this many days. A weekly sweep that keeps seeing
 * a still-dormant contact won't stage a fresh draft until the cooldown lapses.
 */
export const REDRAFT_COOLDOWN_DAYS = 7;

/** The follow-up cadence — a swept source's next_sweep_at advances by this many days. */
export const SWEEP_INTERVAL_DAYS = 7;

/** How the Email Drafter is steered for each relationship (PA-FUS-2). */
export type FollowupToneSpec = {
  /** The `tone` note passed to generateEmailDraft. */
  tone: string;
  /** The `purpose` passed to generateEmailDraft. */
  purpose: string;
  /** The `relationship` label passed to generateEmailDraft. */
  relationshipLabel: string;
  /** A default subject line — the owner edits it on the staged draft card. */
  subjectDefault: string;
};

export const TONE_BY_RELATIONSHIP: Record<FollowupRelationship, FollowupToneSpec> = {
  cold_lead: {
    tone: "Warm reactivation. Low pressure, specific, human — never a mass cold-email template.",
    purpose:
      "Re-open the conversation with a lead who went quiet. Give them one fresh, specific reason to reply now, and keep the ask tiny. Acknowledge the gap lightly without guilt-tripping.",
    relationshipLabel: "Cold lead that went quiet",
    subjectDefault: "Picking this back up",
  },
  active_customer: {
    tone: "Genuine check-in. Friendly and brief — make sure they're taken care of, no hard ask.",
    purpose:
      "Check in with an active customer you haven't spoken to in a while. Make it about them and how things are going, not about selling. Only raise a next step if it's genuinely useful to them.",
    relationshipLabel: "Active customer you've gone quiet on",
    subjectDefault: "Quick check-in",
  },
  past_customer: {
    tone: "Deeper reactivation. Warm, honest about the time that's passed, with a concrete reason to reconnect.",
    purpose:
      "Reconnect with a past customer after a long gap. Acknowledge the time honestly, give them a concrete, specific reason to come back now, and keep the first ask small.",
    relationshipLabel: "Past customer you'd like to win back",
    subjectDefault: "Been a while — thought of you",
  },
};

export function toneFor(relationship: FollowupRelationship): FollowupToneSpec {
  return TONE_BY_RELATIONSHIP[relationship];
}

/** A short human label for a source type, for cards and the dashboard. */
export const SOURCE_TYPE_LABEL: Record<FollowupSourceType, string> = {
  gmail: "Gmail",
  brain_customer: "Brain customers",
  lead_scout: "Lead Scout leads",
};
