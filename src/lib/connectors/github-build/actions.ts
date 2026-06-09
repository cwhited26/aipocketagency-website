// connectors/github-build/actions.ts — the GitHub Build connector's action registry + the
// in-process executor the approval route calls (via lib/connectors/registry.ts) the moment the
// owner approves a staged build action.
//
// Four actions, all writes, all approval-gated (Build Tools SPEC §7.1):
//   • create_repo        — create a new repo on the owner's account (gated; trust window applies).
//   • push_files         — commit a set of files as ONE commit. ALWAYS single-approval — NEVER
//                          auto-approve-eligible regardless of count (SPEC §11, the adversarial
//                          defense). Enforced in tier-caps (window = Infinity) + the auto-approve
//                          toggle route; this connector marks its gate 'always_gated' to match.
//   • create_branch      — branch off a base (gated; trust window applies).
//   • open_pull_request  — open a PR (gated; trust window applies).
//
// Direct REST against GitHub API v3 (./api.ts), no Octokit. The OAuth access token is decrypted
// from the connection here and never leaves this process.

import { z } from "zod";
import {
  countRecentConnectorActions,
  logConnectorAction,
  OrchestratorDbError,
} from "@/lib/orchestrator/db";
import { decrypt, DecryptionError } from "@/lib/crypto/encrypt";
import {
  fetchGithubBuildConnectionFull,
  markGithubBuildConnectionError,
} from "@/lib/pa-github-build-connections";
import {
  createRepo as apiCreateRepo,
  createRef,
  getBranchHeadSha,
  openPullRequest as apiOpenPullRequest,
  pushFilesToBranch,
  type GithubCallContext,
  type RepoFile,
} from "./api";
import { linkRepoToWorkspace } from "./workspace";
import type {
  ActionExecOutcome,
  ApprovalGate,
  GithubBuildActionMeta,
  GithubBuildActionName,
} from "./types";

export const GITHUB_BUILD_CONNECTOR = "github_build";

// ── Per-action gates ────────────────────────────────────────────────────────────────────────
const GATES: Record<GithubBuildActionName, ApprovalGate> = {
  create_repo: "gated",
  push_files: "always_gated",
  create_branch: "gated",
  open_pull_request: "gated",
};

const DESCRIPTIONS: Record<GithubBuildActionName, string> = {
  create_repo: "Create a new repository on the owner's GitHub account.",
  push_files: "Commit a set of files to a branch as one commit (always single-approval).",
  create_branch: "Create a new branch from a base branch.",
  open_pull_request: "Open a pull request from a head branch into a base branch.",
};

// Action registry (meta only — safe to surface in the UI / scope lists).
export const GITHUB_BUILD_ACTIONS: readonly GithubBuildActionMeta[] = (
  Object.keys(GATES) as GithubBuildActionName[]
).map((action) => ({
  name: action,
  connector: "github_build",
  action,
  description: DESCRIPTIONS[action],
  gate: GATES[action],
}));

const KNOWN_ACTIONS = new Set<string>(Object.keys(GATES));

export function isGithubBuildAction(action: string): action is GithubBuildActionName {
  return KNOWN_ACTIONS.has(action);
}

export function githubBuildActionGate(action: GithubBuildActionName): ApprovalGate {
  return GATES[action];
}

/**
 * Actions that can NEVER become auto-approve eligible regardless of approval count
 * (gate === "always_gated"). push_files is the canonical case (SPEC §11). The hard enforcement
 * lives in tier-caps (trust window = Infinity) and the auto-approve toggle route; this mirrors it
 * for any caller that has the connector module in hand.
 */
export function isGithubBuildNeverAutoApprove(action: GithubBuildActionName): boolean {
  return GATES[action] === "always_gated";
}

// Every action here mutates, so all four key the per-minute write cap.
export const GITHUB_BUILD_WRITE_ACTIONS: readonly GithubBuildActionName[] = Object.keys(
  GATES,
) as GithubBuildActionName[];

// ── Input schemas ────────────────────────────────────────────────────────────────────────────

const FileSchema = z.object({
  path: z.string().min(1).max(400),
  content: z.string().max(1_000_000),
});

export const CreateRepoInputSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[A-Za-z0-9._-]+$/, "repo name may only contain letters, digits, '.', '_', '-'"),
  private: z.boolean().optional().default(true),
  description: z.string().max(350).optional(),
  // When the repo belongs to a Project, its id wires the repo back to the Project Workspace.
  project_id: z.string().min(1).max(100).optional(),
});

export const PushFilesInputSchema = z.object({
  repo: z.string().min(1).max(140),
  branch: z.string().min(1).max(250),
  files: z.array(FileSchema).min(1).max(100),
  message: z.string().min(1).max(2000),
});

export const CreateBranchInputSchema = z.object({
  repo: z.string().min(1).max(140),
  base: z.string().min(1).max(250),
  name: z.string().min(1).max(250),
});

export const OpenPullRequestInputSchema = z.object({
  repo: z.string().min(1).max(140),
  head: z.string().min(1).max(250),
  base: z.string().min(1).max(250),
  title: z.string().min(1).max(300),
  body: z.string().max(20_000).optional(),
});

// ── Repo reference resolution ──────────────────────────────────────────────────────────────────
// A `repo` payload may be "owner/name" or just "name"; a bare name resolves against the connected
// login. Returns null when a bare name is given but the login is unknown (can't safely guess owner).
function resolveRepo(
  ref: string,
  login: string | null,
): { owner: string; repo: string } | null {
  const slash = ref.indexOf("/");
  if (slash > 0) {
    return { owner: ref.slice(0, slash), repo: ref.slice(slash + 1) };
  }
  if (!login) return null;
  return { owner: login, repo: ref };
}

// ── The four actions ─────────────────────────────────────────────────────────────────────────

type ActionContext = {
  ctx: GithubCallContext;
  login: string | null;
  ownerUserId: string;
};

export async function createRepo(
  c: ActionContext,
  input: z.infer<typeof CreateRepoInputSchema>,
): Promise<ActionExecOutcome> {
  const res = await apiCreateRepo(c.ctx, {
    name: input.name,
    private: input.private,
    description: input.description,
  });
  if (!res.ok) return res;

  const repo = res.data;
  let summary = `Created ${repo.private ? "private" : "public"} repo ${repo.full_name} → ${repo.html_url}`;

  // Wire the new repo into its Project Workspace when this build belongs to a Project. Best-effort:
  // the outcome is folded into the summary (never silently dropped) so a missing/down endpoint is
  // visible to the owner without failing the repo creation.
  if (input.project_id) {
    const link = await linkRepoToWorkspace({
      projectId: input.project_id,
      ownerUserId: c.ownerUserId,
      githubRepoUrl: repo.html_url,
      githubRepoFullName: repo.full_name,
    });
    summary += link.linked
      ? " · linked to project workspace"
      : ` · workspace link deferred (${link.reason})`;
  }

  return {
    ok: true,
    summary,
    data: {
      full_name: repo.full_name,
      html_url: repo.html_url,
      default_branch: repo.default_branch,
      private: repo.private,
    },
  };
}

export async function pushFiles(
  c: ActionContext,
  input: z.infer<typeof PushFilesInputSchema>,
): Promise<ActionExecOutcome> {
  const target = resolveRepo(input.repo, c.login);
  if (!target) return badRepoRef();

  const files: RepoFile[] = input.files.map((f) => ({ path: f.path, content: f.content }));
  const res = await pushFilesToBranch(c.ctx, {
    owner: target.owner,
    repo: target.repo,
    branch: input.branch,
    files,
    message: input.message,
  });
  if (!res.ok) return res;

  return {
    ok: true,
    summary: `Pushed ${files.length} file${files.length === 1 ? "" : "s"} to ${target.owner}/${target.repo}@${input.branch} (${res.data.commitSha.slice(0, 7)})`,
    data: { commit_sha: res.data.commitSha, files: files.map((f) => f.path) },
  };
}

export async function createBranch(
  c: ActionContext,
  input: z.infer<typeof CreateBranchInputSchema>,
): Promise<ActionExecOutcome> {
  const target = resolveRepo(input.repo, c.login);
  if (!target) return badRepoRef();

  const head = await getBranchHeadSha(c.ctx, target.owner, target.repo, input.base);
  if (!head.ok) return head;

  const created = await createRef(
    c.ctx,
    target.owner,
    target.repo,
    input.name,
    head.data.object.sha,
  );
  if (!created.ok) return created;

  return {
    ok: true,
    summary: `Created branch ${input.name} from ${input.base} on ${target.owner}/${target.repo}`,
    data: { ref: created.data.ref, sha: head.data.object.sha },
  };
}

export async function openPullRequest(
  c: ActionContext,
  input: z.infer<typeof OpenPullRequestInputSchema>,
): Promise<ActionExecOutcome> {
  const target = resolveRepo(input.repo, c.login);
  if (!target) return badRepoRef();

  const res = await apiOpenPullRequest(c.ctx, target.owner, target.repo, {
    head: input.head,
    base: input.base,
    title: input.title,
    body: input.body,
  });
  if (!res.ok) return res;

  return {
    ok: true,
    summary: `Opened PR #${res.data.number} (${input.head} → ${input.base}) on ${target.owner}/${target.repo} → ${res.data.html_url}`,
    data: { number: res.data.number, html_url: res.data.html_url, state: res.data.state },
  };
}

function badRepoRef(): ActionExecOutcome {
  return {
    ok: false,
    status: 422,
    error: "repo must be 'owner/name', or a bare name once GitHub is connected.",
    authError: false,
  };
}

function badPayload(message: string): ActionExecOutcome {
  return { ok: false, status: 422, error: message, authError: false };
}

// ── Dispatch (payload validated per-action) ────────────────────────────────────────────────────

async function executeCore(
  action: GithubBuildActionName,
  c: ActionContext,
  payload: Record<string, unknown>,
): Promise<ActionExecOutcome> {
  switch (action) {
    case "create_repo": {
      const parsed = CreateRepoInputSchema.safeParse(payload);
      if (!parsed.success) return badPayload(parsed.error.message);
      return createRepo(c, parsed.data);
    }
    case "push_files": {
      const parsed = PushFilesInputSchema.safeParse(payload);
      if (!parsed.success) return badPayload(parsed.error.message);
      return pushFiles(c, parsed.data);
    }
    case "create_branch": {
      const parsed = CreateBranchInputSchema.safeParse(payload);
      if (!parsed.success) return badPayload(parsed.error.message);
      return createBranch(c, parsed.data);
    }
    case "open_pull_request": {
      const parsed = OpenPullRequestInputSchema.safeParse(payload);
      if (!parsed.success) return badPayload(parsed.error.message);
      return openPullRequest(c, parsed.data);
    }
    default: {
      const _never: never = action;
      return badPayload(`Unknown github_build action: ${String(_never)}`);
    }
  }
}

// ── High-level executor (resolve connection → decrypt token → run → audit) ──────────────────────

export type GithubBuildExecuteResult =
  | { ok: true; summary: string; data: Record<string, unknown> }
  | { ok: false; status: number; error: string };

export type RunGithubBuildActionInput = {
  userId: string;
  action: string;
  payload: Record<string, unknown>;
  subAgentRunId?: string | null;
  ownerEmail?: string | null;
};

// Per-user-per-minute write cap — every build action mutates, so a burst is cheap to reject before
// the API round-trip.
const DEFAULT_MAX_WRITES_PER_MIN = 10;

export function githubBuildMaxWritesPerMin(): number {
  const raw = process.env.PA_GITHUB_BUILD_MAX_WRITES_PER_MIN;
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_MAX_WRITES_PER_MIN;
  return n;
}

export function rateCapExceeded(recentWrites: number, cap: number): boolean {
  return recentWrites >= cap;
}

export async function executeGithubBuildAction(
  input: RunGithubBuildActionInput,
): Promise<GithubBuildExecuteResult> {
  if (!isGithubBuildAction(input.action)) {
    return { ok: false, status: 400, error: `Unknown GitHub Build action: ${input.action}` };
  }
  const action = input.action;

  const conn = await fetchGithubBuildConnectionFull(input.userId);
  if (!conn.ok) return { ok: false, status: conn.status, error: conn.error };
  if (!conn.data || conn.data.status === "revoked" || !conn.data.accessTokenEncrypted) {
    return {
      ok: false,
      status: 409,
      error: "Connect GitHub Build in Settings → Connections before running build actions.",
    };
  }

  let accessToken: string;
  try {
    accessToken = decrypt(conn.data.accessTokenEncrypted);
  } catch (e) {
    if (e instanceof DecryptionError) {
      await markGithubBuildConnectionError(conn.data.id);
      return {
        ok: false,
        status: 401,
        error: "GitHub token unreadable — reconnect GitHub Build in Settings → Connections.",
      };
    }
    throw e;
  }

  // Per-minute write cap (checked before the API round-trip).
  const cap = githubBuildMaxWritesPerMin();
  const since = new Date(Date.now() - 60_000).toISOString();
  let recent: number;
  try {
    recent = await countRecentConnectorActions({
      businessId: input.userId,
      connector: GITHUB_BUILD_CONNECTOR,
      status: "executed",
      sinceIso: since,
      actions: GITHUB_BUILD_WRITE_ACTIONS,
    });
  } catch (e) {
    if (e instanceof OrchestratorDbError && e.schemaNotProvisioned) recent = 0;
    else throw e;
  }
  if (rateCapExceeded(recent, cap)) {
    return {
      ok: false,
      status: 429,
      error: `GitHub Build rate cap reached (${cap}/min). Try again in a minute.`,
    };
  }

  const c: ActionContext = {
    ctx: { accessToken },
    login: conn.data.login,
    ownerUserId: input.userId,
  };

  const outcome = await executeCore(action, c, input.payload);

  if (!outcome.ok) {
    await logExecuted(input, action, "failed", outcome.error);
    if (outcome.authError) {
      await markGithubBuildConnectionError(conn.data.id);
      return {
        ok: false,
        status: 401,
        error: "GitHub disconnected — reconnect GitHub Build in Settings → Connections.",
      };
    }
    return { ok: false, status: outcome.status, error: outcome.error };
  }

  await logExecuted(input, action, "executed", outcome.summary);
  return { ok: true, summary: outcome.summary, data: outcome.data };
}

// Audit-log the terminal outcome of a write. Best-effort: a missing audit table (migration not
// applied) must not fail an otherwise-successful action.
async function logExecuted(
  input: RunGithubBuildActionInput,
  action: GithubBuildActionName,
  status: "executed" | "failed",
  summary: string,
): Promise<void> {
  try {
    await logConnectorAction({
      businessId: input.userId,
      subAgentRunId: input.subAgentRunId ?? null,
      connector: GITHUB_BUILD_CONNECTOR,
      action,
      payloadHash: "",
      status,
      responseSummary: summary.slice(0, 500),
    });
  } catch (e) {
    if (e instanceof OrchestratorDbError && e.schemaNotProvisioned) return;
    throw e;
  }
}
