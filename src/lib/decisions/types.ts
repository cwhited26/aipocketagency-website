// types.ts — shared, I/O-free types for the Decision Roundtable (PA-DR-1..7). The orchestration,
// data-access, and route layers all import from here so the role/status/decision vocabularies have
// one source of truth.

export const ROUNDTABLE_ROLES = [
  "steelman",
  "devils_advocate",
  "domain_specialist",
  "moderator",
  "owner_interjection",
] as const;
export type RoundtableRole = (typeof ROUNDTABLE_ROLES)[number];

// The roles that actually argue each round (the Moderator runs once at the end; an interjection is
// the owner's, not an agent's).
export const ARGUING_ROLES = ["steelman", "devils_advocate", "domain_specialist"] as const;
export type ArguingRole = (typeof ARGUING_ROLES)[number];

export const ROUNDTABLE_STATUSES = [
  "running",
  "verdict_ready",
  "saved",
  "rejected",
  "cancelled",
] as const;
export type RoundtableStatus = (typeof ROUNDTABLE_STATUSES)[number];

export const DECISION_TYPES = ["pricing", "hiring", "firing", "acquisition", "scope", "other"] as const;
export type DecisionType = (typeof DECISION_TYPES)[number];

export const STAKES_LEVELS = ["low", "medium", "high"] as const;
export type StakesLevel = (typeof STAKES_LEVELS)[number];

export const ROLE_LABELS: Record<RoundtableRole, string> = {
  steelman: "Steel-man",
  devils_advocate: "Devil's Advocate",
  domain_specialist: "Domain Specialist",
  moderator: "Moderator",
  owner_interjection: "You",
};

export type Roundtable = {
  id: string;
  owner_id: string;
  conversation_id: string | null;
  question: string;
  status: RoundtableStatus;
  decision_type: DecisionType;
  stakes_level: StakesLevel;
  model_backings: string[];
  total_rounds: number;
  verdict: string | null;
  verdict_brain_path: string | null;
  rejection_reason: string | null;
  started_at: string;
  completed_at: string | null;
  saved_at: string | null;
  created_at: string;
};

export type RoundtableTurn = {
  id: string;
  roundtable_id: string;
  owner_id: string;
  role: RoundtableRole;
  model_backing: string;
  round_index: number;
  turn_index: number;
  content: string;
  created_at: string;
};

// The Moderator's structured output, parsed out of its single final turn. The verdict card pre-fills
// its editable area with `recommendation`; the dissent + evidence render read-only beside it.
export type Verdict = {
  recommendation: string;
  strongestDissent: string;
  supportingEvidence: string;
};
