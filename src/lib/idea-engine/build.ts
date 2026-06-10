// build.ts — the Idea Engine auto-build state machine (PA-IDEA-2, Studio+/Enterprise). Stages 4
// (the MVP) and 5 (the sales page) both ship code to the owner's own GitHub + Vercel by reusing the
// shipped Build Tools connectors (github_build, vercel, supabase) through the same approval-gated,
// one-step-per-approval pattern the Landing Page Builder proved (lib/landing-pages). We reuse its
// Next.js scaffold (scaffoldFiles) rather than duplicate it.
//
// The chain (PA-IDEA-8) is now FIVE phases, with the database phase conditional on the blueprint's
// `needs_database` flag:
//
//   create the GitHub repo → push the files
//     → [needs_database] create the Supabase project → apply the starter schema migration
//     → create the Vercel project → [needs_database] inject the Supabase env vars
//     → deploy
//
// When `needs_database` is false the Supabase + env-injection steps drop out and the build is the
// original four connector steps. Each step stages a `build_action_approval` Inbox card (the existing
// approval kind — no new plumbing). push_files (github_build) and apply_migration (supabase) are
// NEVER auto-approved — the connectors enforce that hard rule; we do nothing to weaken it.
//
// Modal is deliberately NOT in this chain (PA-IDEA-9). A startable MVP needs frontend + data + code —
// GitHub + Vercel + Supabase. Modal is a long-running Python / GPU runtime an owner rarely needs yet;
// adding it would impose a recurring runtime cost on every MVP. If a future MVP truly needs it, that's
// a separate Studio+ App, not a default here.
//
// The build state for a given (idea, build kind) lives in that stage's pa_idea_stage_runs.output (the
// IdeaBuildState below). Each step is staged via stageConnectorAction with the connector payload
// carrying `idea_id` + `idea_build`, so the orchestrator approvals route can advance the build after
// the step executes (mirroring advanceLandingPageBuildAfterApproval). The connector executor zod-strips
// those two keys; the stored pa_action_approvals payload keeps them. Secrets the build generates (the
// Supabase database password, the service-role key) are staged AES-256-GCM-encrypted, never plaintext.

import { randomBytes } from "node:crypto";
import { stageConnectorAction } from "@/lib/orchestrator/tool-use";
import { encrypt } from "@/lib/crypto/encrypt";
import { fetchSupabaseProjectCredentials } from "@/lib/connectors/supabase";
import { getIdeaById, listStageRuns, updateStageRun, updateIdea } from "./store";
import { writeSnapshotFile, renderReadmeMd, type BrainCtx } from "./snapshot";
import { ideaLog, errMsg } from "./log";
import { latestRunsByStage } from "./store";
import type { StageRunRow } from "./types";

export type IdeaBuildKind = "mvp" | "sales";

/**
 * The build cursor — names the connector step currently staged for approval (or the terminal `live`).
 * Distinct from the Landing Page Builder's `BuildStep` because the Idea Engine's chain has the two
 * conditional Supabase steps + the env-injection step the landing-page chain does not.
 */
export type IdeaBuildStep =
  | "repo"
  | "push"
  | "supabase_project"
  | "supabase_migration"
  | "vercel_project"
  | "vercel_env"
  | "deploy"
  | "live";

/** The pa_idea_stage_runs.output shape for a build stage. */
export type IdeaBuildState = {
  buildKind: IdeaBuildKind;
  slug: string;
  files: Record<string, string>;
  cursor: IdeaBuildStep;
  /** Whether the blueprint declared the MVP needs a database (PA-IDEA-8). Sales builds are always false. */
  needsDatabase: boolean;
  /** The starter schema applied to the new Supabase project (only used when needsDatabase). */
  schemaSql: string;
  repoFullName: string | null;
  supabaseProjectRef: string | null;
  vercelProjectId: string | null;
  deployUrl: string | null;
  githubLogin: string | null;
};

const STAGE_FOR: Record<IdeaBuildKind, number> = { mvp: 4, sales: 5 };

const ENV_TARGETS = ["production", "preview", "development"] as const;

function strField(data: Record<string, unknown>, key: string): string | null {
  const v = data[key];
  return typeof v === "string" && v ? v : null;
}

// ── Pure cursor machine (exported for the unit tests) ───────────────────────────────────────────────

export type IdeaStepConnector = "github_build" | "vercel" | "supabase";

export type IdeaStepAction =
  | "create_repo"
  | "push_files"
  | "create_project"
  | "apply_migration"
  | "createProject"
  | "setEnvVars"
  | "triggerDeploy";

/** A staged step's connector + action, independent of its payload (pure, for sequencing + tests). */
export type IdeaStepDescriptor = {
  cursor: IdeaBuildStep;
  connector: IdeaStepConnector;
  action: IdeaStepAction;
};

function cursorDescriptor(cursor: IdeaBuildStep): IdeaStepDescriptor | null {
  switch (cursor) {
    case "repo":
      return { cursor, connector: "github_build", action: "create_repo" };
    case "push":
      return { cursor, connector: "github_build", action: "push_files" };
    case "supabase_project":
      return { cursor, connector: "supabase", action: "create_project" };
    case "supabase_migration":
      return { cursor, connector: "supabase", action: "apply_migration" };
    case "vercel_project":
      return { cursor, connector: "vercel", action: "createProject" };
    case "vercel_env":
      return { cursor, connector: "vercel", action: "setEnvVars" };
    case "deploy":
      return { cursor, connector: "vercel", action: "triggerDeploy" };
    default:
      return null;
  }
}

/** The build cursor that follows the current one. `needsDatabase` gates the two Supabase steps and
 *  the env-injection step; `live` is terminal. */
export function nextIdeaCursor(cursor: IdeaBuildStep, needsDatabase: boolean): IdeaBuildStep | null {
  switch (cursor) {
    case "repo":
      return "push";
    case "push":
      return needsDatabase ? "supabase_project" : "vercel_project";
    case "supabase_project":
      return "supabase_migration";
    case "supabase_migration":
      return "vercel_project";
    case "vercel_project":
      return needsDatabase ? "vercel_env" : "deploy";
    case "vercel_env":
      return "deploy";
    case "deploy":
      return "live";
    default:
      return null;
  }
}

/**
 * The ordered list of connector steps a build stages, from the first (create the repo) to the last
 * (deploy) — the terminal `live` is not a staged step. Pure: the same input always yields the same
 * sequence, so the tests can assert the exact chain (and that Modal never appears — PA-IDEA-9).
 */
export function ideaBuildSequence(needsDatabase: boolean): IdeaStepDescriptor[] {
  const steps: IdeaStepDescriptor[] = [];
  let cursor: IdeaBuildStep | null = "repo";
  while (cursor && cursor !== "live") {
    const desc = cursorDescriptor(cursor);
    if (desc) steps.push(desc);
    cursor = nextIdeaCursor(cursor, needsDatabase);
  }
  return steps;
}

// ── The connector step for a build cursor (idea-appropriate copy; mirrors landing-pages stagePlanFor) ─

type StepPlan = {
  connector: IdeaStepConnector;
  action: IdeaStepAction;
  scopes: readonly string[];
  title: string;
  preview: string;
  payload: Record<string, unknown>;
};

/** Per-var shape staged into the Vercel setEnvVars payload (matches the connector's EnvVarSpec). */
type StagedEnvVar = {
  key: string;
  value?: string;
  value_encrypted?: string;
  encrypted: boolean;
  target: readonly string[];
};

/** Secrets the next step needs, generated at staging time (never persisted in the run state). */
type StepSecrets = {
  /** AES-GCM-encrypted Supabase database password (for create_project). */
  dbPassEncrypted?: string;
  /** The three Supabase env vars (for setEnvVars), service-role key already encrypted. */
  envVars?: StagedEnvVar[];
};

function noun(kind: IdeaBuildKind): string {
  return kind === "mvp" ? "MVP" : "sales page";
}

function stepFor(
  cursor: IdeaBuildStep,
  state: IdeaBuildState,
  ideaId: string,
  secrets: StepSecrets,
): StepPlan | null {
  const base = { idea_id: ideaId, idea_build: state.buildKind };
  const fileEntries = Object.entries(state.files).map(([path, content]) => ({ path, content }));
  const repo = state.repoFullName ?? state.slug;
  const what = noun(state.buildKind);

  switch (cursor) {
    case "repo":
      return {
        connector: "github_build",
        action: "create_repo",
        scopes: ["github_build"],
        title: `Create the GitHub repo for your ${what} ("${state.slug}")`,
        preview: `Pocket Agent will create a new repository "${state.slug}" on your GitHub account to hold the ${what}'s code.`,
        payload: { name: state.slug, private: true, description: `Idea Engine ${what}: ${state.slug}`, ...base },
      };
    case "push":
      return {
        connector: "github_build",
        action: "push_files",
        scopes: ["github_build"],
        title: `Add the ${what}'s files to "${state.slug}"`,
        preview: `Pocket Agent will commit the generated Next.js project (${fileEntries.length} files) to the repo.`,
        payload: { repo, branch: "main", files: fileEntries, message: `Add ${what} generated by Pocket Agent`, ...base },
      };
    case "supabase_project":
      return {
        connector: "supabase",
        action: "create_project",
        scopes: ["supabase"],
        title: `Create the Supabase project for your ${what} ("${state.slug}")`,
        preview: `Your ${what} needs a database. Pocket Agent will create a new Supabase project on your account, with a database password it generates and keeps encrypted (you can rotate it in the Supabase dashboard).`,
        payload: {
          name: state.slug,
          region: "us-east-1",
          plan: "free",
          ...(secrets.dbPassEncrypted ? { db_pass_encrypted: secrets.dbPassEncrypted } : {}),
          ...base,
        },
      };
    case "supabase_migration":
      if (!state.supabaseProjectRef) return null;
      return {
        connector: "supabase",
        action: "apply_migration",
        scopes: ["supabase"],
        title: `Apply the starter schema to your ${what}'s database`,
        preview: `Pocket Agent will run the starter schema on Supabase project "${state.supabaseProjectRef}". The card below shows the full SQL. This is a one-time approval — migrations are never auto-approved.`,
        payload: { project_ref: state.supabaseProjectRef, sql: state.schemaSql, ...base },
      };
    case "vercel_project":
      return {
        connector: "vercel",
        action: "createProject",
        scopes: ["vercel"],
        title: `Create the Vercel project for "${state.slug}"`,
        preview: `Pocket Agent will create a Vercel project linked to the "${state.slug}" repo so it can deploy.`,
        payload: {
          name: state.slug,
          framework: "nextjs",
          gitRepo: state.repoFullName ?? (state.githubLogin ? `${state.githubLogin}/${state.slug}` : state.slug),
          ...base,
        },
      };
    case "vercel_env": {
      if (!state.vercelProjectId) return null;
      const vars = secrets.envVars ?? [];
      return {
        connector: "vercel",
        action: "setEnvVars",
        scopes: ["vercel"],
        title: `Add the Supabase connection details to "${state.slug}"`,
        preview: `Pocket Agent will set ${vars.length} environment variable(s) on the Vercel project so your ${what} can reach its database: ${vars
          .map((v) => v.key)
          .join(", ")}. The service-role key is stored encrypted.`,
        payload: { projectId: state.vercelProjectId, vars, ...base },
      };
    }
    case "deploy":
      if (!state.vercelProjectId) return null;
      return {
        connector: "vercel",
        action: "triggerDeploy",
        scopes: ["vercel"],
        title: `Deploy your ${what} ("${state.slug}")`,
        preview: `Pocket Agent will deploy the project so your ${what} goes live at its own URL.`,
        payload: { projectId: state.vercelProjectId, ref: "main", production: true, ...base },
      };
    default:
      return null;
  }
}

// ── Secret generation (per build, never persisted in the run state) ──────────────────────────────────

/** A strong random Supabase database password (base64url, ≥ the connector's 12-char minimum). */
function generateDbPassword(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * The Supabase env vars to inject into Vercel. URL + anon key are public; the service-role key is
 * staged AES-GCM-encrypted (value_encrypted) and decrypted at execution. Keys that are still coming
 * up (null) are omitted rather than injected empty.
 */
function buildSupabaseEnvVars(
  ref: string,
  creds: { url: string; anonKey: string | null; serviceRoleKey: string | null } | null,
): StagedEnvVar[] {
  const url = creds?.url ?? `https://${ref}.supabase.co`;
  const vars: StagedEnvVar[] = [
    { key: "NEXT_PUBLIC_SUPABASE_URL", value: url, encrypted: false, target: ENV_TARGETS },
  ];
  if (creds?.anonKey) {
    vars.push({ key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", value: creds.anonKey, encrypted: false, target: ENV_TARGETS });
  }
  if (creds?.serviceRoleKey) {
    vars.push({
      key: "SUPABASE_SERVICE_ROLE_KEY",
      value_encrypted: encrypt(creds.serviceRoleKey),
      encrypted: true,
      target: ENV_TARGETS,
    });
  }
  return vars;
}

// Resolve the secrets the next step needs (DB password for create_project, env vars for setEnvVars).
async function secretsFor(cursor: IdeaBuildStep, state: IdeaBuildState, ownerId: string): Promise<StepSecrets> {
  if (cursor === "supabase_project") {
    return { dbPassEncrypted: encrypt(generateDbPassword()) };
  }
  if (cursor === "vercel_env" && state.supabaseProjectRef) {
    const creds = await fetchSupabaseProjectCredentials(ownerId, state.supabaseProjectRef);
    if (!creds.ok) {
      // The project exists; missing keys (still coming up) must not hard-stop the build. Inject the
      // URL we can derive and log the gap — the owner can re-run env injection from the App surface.
      ideaLog.warn("supabase credentials unavailable for env injection", {
        ref: state.supabaseProjectRef,
        error: creds.error,
      });
      return { envVars: buildSupabaseEnvVars(state.supabaseProjectRef, null) };
    }
    return { envVars: buildSupabaseEnvVars(state.supabaseProjectRef, creds.data) };
  }
  return {};
}

// ── Start a build: store the initial state on the run, stage the first step ─────────────────────────

/**
 * Begin a build for one stage run. Writes the build state to the run output, marks it `staged`, and
 * stages the first connector step (create_repo) for owner approval. The MVP/sales files are assembled
 * by the caller (engine.ts) from the blueprint + sales copy. `needsDatabase` (always false for a sales
 * page) and `schemaSql` come from the approved blueprint (PA-IDEA-8).
 */
export async function startIdeaBuild(params: {
  ideaId: string;
  ownerId: string;
  runId: string;
  buildKind: IdeaBuildKind;
  slug: string;
  files: Record<string, string>;
  githubLogin: string | null;
  needsDatabase: boolean;
  schemaSql: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  // A sales page never needs a database — force it off regardless of the blueprint flag.
  const needsDatabase = params.buildKind === "sales" ? false : params.needsDatabase;
  const state: IdeaBuildState = {
    buildKind: params.buildKind,
    slug: params.slug,
    files: params.files,
    cursor: "repo",
    needsDatabase,
    schemaSql: needsDatabase ? params.schemaSql : "",
    repoFullName: null,
    supabaseProjectRef: null,
    vercelProjectId: null,
    deployUrl: null,
    githubLogin: params.githubLogin,
  };
  const step = stepFor("repo", state, params.ideaId, {});
  if (!step) return { ok: false, error: "Could not plan the first build step." };

  await updateStageRun(params.runId, { status: "staged", output: state as unknown as Record<string, unknown> });

  try {
    await stageConnectorAction({
      userId: params.ownerId,
      subAgentRunId: null,
      connector: step.connector,
      action: step.action,
      payload: step.payload,
      declaredScopes: step.scopes,
      title: step.title,
      preview: step.preview,
      kind: "build_action_approval",
    });
  } catch (e) {
    ideaLog.error("startIdeaBuild stage failed", { ideaId: params.ideaId, error: errMsg(e) });
    return { ok: false, error: errMsg(e) };
  }
  return { ok: true };
}

// ── Advance after an approved build step (called from the approvals route) ──────────────────────────

export type IdeaBuildAdvance =
  | { ok: true; advanced: true; nextCursor: IdeaBuildStep }
  | { ok: true; advanced: true; done: true; url: string }
  | { ok: false; status: number; error: string };

/**
 * Find the build (idea, kind) the approved step belongs to, record its artifact, and stage the next
 * step — or, on the terminal deploy, mark the run complete, write the Snapshot build/sales file, and
 * advance the idea. The cursor in the stored state IS the step that just executed, so we advance from
 * it (the Supabase `create_project` and Vercel `createProject` actions differ only by case — keying on
 * the cursor avoids that ambiguity). Best-effort: the connector action already executed, so a hiccup
 * here is reported, never undone.
 */
export async function advanceIdeaBuildAfterApproval(params: {
  approvalPayload: Record<string, unknown>;
  ownerId: string;
  action: string;
  data: Record<string, unknown>;
  brain: BrainCtx | null;
}): Promise<IdeaBuildAdvance> {
  const ideaId = typeof params.approvalPayload.idea_id === "string" ? params.approvalPayload.idea_id : null;
  const buildKindRaw = params.approvalPayload.idea_build;
  const buildKind: IdeaBuildKind | null =
    buildKindRaw === "mvp" || buildKindRaw === "sales" ? buildKindRaw : null;
  if (!ideaId || !buildKind) return { ok: false, status: 400, error: "Not an Idea Engine build step." };

  const stage = STAGE_FOR[buildKind];
  const runsRes = await listStageRuns(params.ownerId, ideaId);
  if (!runsRes.ok) return { ok: false, status: runsRes.status, error: runsRes.error };
  const run = latestRunsByStage(runsRes.data).get(stage);
  if (!run) return { ok: false, status: 404, error: "Build run not found." };

  const state = run.output as unknown as IdeaBuildState;
  if (!state || !state.slug) return { ok: false, status: 422, error: "Build run has no state." };
  // Defensive default for any build started before this field existed.
  const needsDatabase = state.needsDatabase === true;

  // Record the artifact the just-executed step (state.cursor) produced.
  if (state.cursor === "repo") {
    state.repoFullName = strField(params.data, "full_name") ?? state.repoFullName ?? `local/${state.slug}`;
  } else if (state.cursor === "supabase_project") {
    state.supabaseProjectRef = strField(params.data, "projectRef") ?? state.supabaseProjectRef;
  } else if (state.cursor === "vercel_project") {
    state.vercelProjectId = strField(params.data, "projectId") ?? state.vercelProjectId;
  } else if (state.cursor === "deploy") {
    state.deployUrl = strField(params.data, "url") ?? `https://${state.slug}.vercel.app`;
  }

  const next = nextIdeaCursor(state.cursor, needsDatabase);
  if (!next) return { ok: false, status: 422, error: `Unexpected build cursor "${state.cursor}".` };

  // Terminal: deploy done → build is live.
  if (next === "live") {
    state.cursor = "live";
    const url = state.deployUrl ?? `https://${state.slug}.vercel.app`;
    await updateStageRun(run.id, {
      status: "complete",
      output: state as unknown as Record<string, unknown>,
      completed_at: new Date().toISOString(),
    });
    await onBuildComplete(ideaId, params.ownerId, buildKind, state, url, params.brain);
    return { ok: true, advanced: true, done: true, url };
  }

  // Stage the next step (resolving any secrets it needs first).
  state.cursor = next;
  const secrets = await secretsFor(next, state, params.ownerId);
  const step = stepFor(next, state, ideaId, secrets);
  await updateStageRun(run.id, { status: "staged", output: state as unknown as Record<string, unknown> });
  if (!step) return { ok: false, status: 422, error: `No step for cursor "${next}".` };
  try {
    await stageConnectorAction({
      userId: params.ownerId,
      subAgentRunId: null,
      connector: step.connector,
      action: step.action,
      payload: step.payload,
      declaredScopes: step.scopes,
      title: step.title,
      preview: step.preview,
      kind: "build_action_approval",
    });
  } catch (e) {
    ideaLog.error("advanceIdeaBuild stage failed", { ideaId, error: errMsg(e) });
    return { ok: false, status: 500, error: errMsg(e) };
  }
  return { ok: true, advanced: true, nextCursor: next };
}

// On a finished build, write the Snapshot file and advance the idea's stage (MVP done → ready for
// sales; sales done → ready for launch). The idea's current_stage only moves forward.
async function onBuildComplete(
  ideaId: string,
  ownerId: string,
  buildKind: IdeaBuildKind,
  state: IdeaBuildState,
  url: string,
  brain: BrainCtx | null,
): Promise<void> {
  const idea = await getIdeaById(ownerId, ideaId);
  const title = idea.ok && idea.data ? idea.data.title : state.slug;

  if (brain) {
    const file = buildKind === "mvp" ? "build.md" : "sales.md";
    await writeSnapshotFile(brain, state.slug, file, renderBuildMd(buildKind, state, url));
    // Refresh the Snapshot README with a Stack line naming every shipped piece (PA-IDEA-8).
    await writeSnapshotFile(brain, state.slug, "README.md", renderReadmeMd(title, state.slug, stackLine(state)));
  }

  if (idea.ok && idea.data) {
    const reached = buildKind === "mvp" ? 5 : 6;
    if (idea.data.current_stage < reached) {
      await updateIdea(ownerId, ideaId, { current_stage: reached });
    }
  }
}

/** One-line stack summary for the README — names every shipped piece of this build. */
export function stackLine(state: IdeaBuildState): string {
  const parts = ["Next.js on Vercel"];
  if (state.supabaseProjectRef) parts.push(`Supabase project \`${state.supabaseProjectRef}\``);
  parts.push(`GitHub repo \`${state.repoFullName ?? state.slug}\``);
  return parts.join(" + ");
}

/**
 * The build.md / sales.md body for a finished build — records the live URL, repo, and (when present)
 * the Supabase project ref + the schema migration that was applied.
 */
export function renderBuildMd(buildKind: IdeaBuildKind, state: IdeaBuildState, url: string): string {
  if (buildKind === "sales") {
    return [
      `# Sales page`,
      "",
      `**Live sales page:** ${url}`,
      `**GitHub repo:** ${state.repoFullName ?? state.slug}`,
      "",
      "Point your prospects here. The first 25 outreach drafts go out in the Launch stage.",
    ].join("\n");
  }
  const lines = [
    `# Build artifacts`,
    "",
    `**Stack:** ${stackLine(state)}`,
    `**Live MVP:** ${url}`,
    `**GitHub repo:** ${state.repoFullName ?? state.slug}`,
  ];
  if (state.supabaseProjectRef) {
    lines.push(`**Supabase project:** ${state.supabaseProjectRef} (https://${state.supabaseProjectRef}.supabase.co)`);
    lines.push("");
    lines.push("## Schema migration applied");
    lines.push("");
    lines.push("```sql");
    lines.push(state.schemaSql.trim() || "-- (no schema recorded)");
    lines.push("```");
    lines.push("");
    lines.push(
      "Pocket Agent set the database password and stored it encrypted. Rotate it in the Supabase dashboard whenever you want — the env vars in Vercel point at this project.",
    );
  } else {
    lines.push("");
    lines.push("This MVP ships without a database. The code is yours, on your accounts. Re-run this stage to rebuild.");
  }
  return lines.join("\n");
}

/** Re-export so the approvals route can detect an Idea Engine build step without importing the engine. */
export function ideaBuildIdOf(payload: Record<string, unknown>): string | null {
  return typeof payload.idea_id === "string" && payload.idea_id ? payload.idea_id : null;
}

export type { StageRunRow };
