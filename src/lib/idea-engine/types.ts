// types.ts — the Idea Engine domain model (PA-IDEA-1). Pure types + small pure helpers (no I/O), so
// both the store, the engine, the API routes, and the unit tests read the same shapes.
//
// The engine chains six stages, each backed by an already-shipped PA primitive. The numbering (1..6)
// is the database `stage` column and the surface's progress view; the backbones are documented here so
// the mapping never drifts from the SPEC (APA/Products/Pocket_Agent_Idea_Engine_SPEC_v1.md §1).

export const IDEA_SOURCES = ["typed", "voice", "share"] as const;
export type IdeaSource = (typeof IDEA_SOURCES)[number];

export const IDEA_STATUSES = ["active", "archived", "forked"] as const;
export type IdeaStatus = (typeof IDEA_STATUSES)[number];

export const STAGE_STATUSES = [
  "queued",
  "running",
  "staged",
  "approved",
  "rejected",
  "complete",
  "error",
] as const;
export type StageStatus = (typeof STAGE_STATUSES)[number];

/** The two build modes (PA-IDEA-2). Pro+ gets prompt-pack; Studio+/Enterprise gets auto-build. */
export type BuildMode = "prompt_pack" | "auto_build";

export type StageNumber = 1 | 2 | 3 | 4 | 5 | 6;
export const STAGE_NUMBERS: StageNumber[] = [1, 2, 3, 4, 5, 6];

/** A stage definition: its number, name, the shipped primitive it delegates to, and one-line intent. */
export type StageDef = {
  stage: StageNumber;
  key: string;
  name: string;
  /** The already-shipped primitive this stage chains (SPEC §1). */
  backbone: string;
  /** One-line plain-English description for the surface. */
  summary: string;
  /** True when this stage pauses for the owner to approve in Mission Control before the next fires. */
  stagesForApproval: boolean;
};

// The canonical six-stage chain. The `backbone` strings are the report's "6 stage names + their
// primitive backbones" — keep them honest and in sync with the SPEC.
export const STAGES: StageDef[] = [
  {
    stage: 1,
    key: "capture",
    name: "Capture",
    backbone: "Capture Inbox / inbox.md / voice memo",
    summary: "Drop an idea — typed, a voice memo, or a shared link. PA reads it and opens a Snapshot.",
    stagesForApproval: false,
  },
  {
    stage: 2,
    key: "validation",
    name: "Market validation",
    backbone: "Lead Scout (Bright Data SERP + Haiku classifier)",
    summary: "PA scans the market: who's already doing this, the price range, the strongest competitor, and 25 prospects who fit.",
    stagesForApproval: false,
  },
  {
    stage: 3,
    key: "blueprint",
    name: "MVP blueprint",
    backbone: "Project Scaffolding (Project → Milestones → Tasks)",
    summary: "PA writes the build plan. You approve it in Mission Control before anything ships.",
    stagesForApproval: true,
  },
  {
    stage: 4,
    key: "build",
    name: "Build",
    backbone: "Email Drafter (prompt pack) / Build Tools (auto-build)",
    summary: "Prompt-pack mode hands you the prompts to run. Auto-build mode ships the MVP on your GitHub + Vercel, one approval per step.",
    stagesForApproval: true,
  },
  {
    stage: 5,
    key: "sales",
    name: "Sales surface",
    backbone: "Landing Page Builder + Content Creator voice",
    summary: "PA drafts the sales copy and deploys a sales page to the same Vercel account.",
    stagesForApproval: true,
  },
  {
    stage: 6,
    key: "launch",
    name: "Launch",
    backbone: "Lead Scout outreach loop + weekly Routine",
    summary: "PA drafts the first 25 outreach emails to the stage-2 prospects and schedules a weekly follow-up.",
    stagesForApproval: true,
  },
];

export function stageDef(stage: number): StageDef | null {
  return STAGES.find((s) => s.stage === stage) ?? null;
}

// ── DB row shapes (mirror migration 071) ──────────────────────────────────────────────────────────

export type IdeaRow = {
  id: string;
  owner_id: string;
  slug: string;
  title: string;
  source: IdeaSource;
  source_payload: Record<string, unknown>;
  current_stage: number;
  status: IdeaStatus;
  snapshot_brain_path: string | null;
  created_at: string;
  updated_at: string;
};

export type StageRunRow = {
  id: string;
  idea_id: string;
  owner_id: string;
  stage: number;
  status: StageStatus;
  output: Record<string, unknown>;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

// ── Stage-2 (market validation) structured output ──────────────────────────────────────────────────

/** A prospect surfaced by the market scan — the seed for stage-6 outreach. */
export type Prospect = {
  name: string;
  website: string;
  summary: string;
  contact: string;
  fit: string;
  category: string;
};

export type MarketScan = {
  ideaSpace: string;
  vertical: string;
  competitorCount: number;
  strongestCompetitor: string;
  priceRange: string;
  icp: string;
  prospects: Prospect[];
};

// ── View model the surfaces render ─────────────────────────────────────────────────────────────────

export type StageView = {
  stage: StageNumber;
  name: string;
  backbone: string;
  summary: string;
  status: StageStatus | "not_started";
  error: string | null;
  completedAt: string | null;
};

export type IdeaView = {
  id: string;
  slug: string;
  title: string;
  source: IdeaSource;
  status: IdeaStatus;
  currentStage: number;
  snapshotPath: string | null;
  createdAt: string;
  updatedAt: string;
  stages: StageView[];
};

/**
 * Fold an idea + its latest run per stage into the surface view model. `latestRuns` is keyed by stage
 * number → the most recent run row for that stage (the store resolves "latest" before calling this).
 */
export function toIdeaView(idea: IdeaRow, latestRuns: Map<number, StageRunRow>): IdeaView {
  return {
    id: idea.id,
    slug: idea.slug,
    title: idea.title,
    source: idea.source,
    status: idea.status,
    currentStage: idea.current_stage,
    snapshotPath: idea.snapshot_brain_path,
    createdAt: idea.created_at,
    updatedAt: idea.updated_at,
    stages: STAGES.map((s): StageView => {
      const run = latestRuns.get(s.stage);
      return {
        stage: s.stage,
        name: s.name,
        backbone: s.backbone,
        summary: s.summary,
        status: run ? run.status : "not_started",
        error: run?.error ?? null,
        completedAt: run?.completed_at ?? null,
      };
    }),
  };
}

/**
 * An owner-scoped, URL-safe slug for an idea. Title → lowercase hyphenated base + a short id suffix so
 * two ideas with the same title don't collide. Matches the GitHub repo + Vercel project name regex
 * (lowercase letters, digits, '-'), so the same slug seeds the auto-build repo names. Mirrors
 * landing-pages/build.ts `landingSlug`.
 */
export function ideaSlug(title: string, id: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  const suffix = id.replace(/[^a-z0-9]/gi, "").slice(0, 6).toLowerCase();
  return `${base || "idea"}-${suffix || "draft"}`;
}

/** The Snapshot folder root in the owner's brain for an idea (SPEC §4). */
export function snapshotPath(slug: string): string {
  return `brain/ideas/${slug}`;
}

/** The deterministic cost-ledger idempotency key for a stage step (SPEC §5, PA-IDEA-6). */
export function costKey(ideaId: string, stage: number, step: string): string {
  return `idea:${ideaId}:stage:${stage}:${step}`;
}
