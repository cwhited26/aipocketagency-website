// connectors/github-build/api.ts — GitHub REST API v3 client (direct fetch, no Octokit).
//
// Every call authenticates with the owner's OAuth access token as the Bearer credential and pins
// the API version header. The action layer (./actions.ts) builds the request inputs (pure) and
// calls these; only these functions touch the network. Responses are validated with Zod at the
// boundary, so nothing downstream sees `any`.
//
// push_files is implemented against the Git Data API (blobs/trees/commits/refs) so a set of files
// lands as ONE commit on a branch, with file content sent inline in the tree (no separate blob
// round-trip per file). This keeps a multi-file scaffold atomic — either the whole commit lands or
// none of it does.

import { z } from "zod";

const BASE = "https://api.github.com";

export type GithubApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string; authError: boolean };

export type GithubCallContext = {
  /** The owner's OAuth access token (Bearer credential). */
  accessToken: string;
};

// 401 (bad/revoked token) or 403 with a credential/SSO message means the connection is dead and
// the owner must reconnect. A plain 403 rate-limit is NOT an auth failure (handled by the caller).
function isAuthFailure(status: number, body: string): boolean {
  if (status === 401) return true;
  if (status === 403) {
    return (
      body.includes("Bad credentials") ||
      body.includes("token") ||
      body.includes("SSO") ||
      body.includes("must be granted")
    );
  }
  return false;
}

function headers(ctx: GithubCallContext): Record<string, string> {
  return {
    Authorization: `Bearer ${ctx.accessToken}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "PocketAgent",
  };
}

// GitHub's error envelope: { message, documentation_url, errors? }. Pull the human message out.
const ErrorEnvelopeSchema = z.object({ message: z.string().optional() });

function extractError(text: string, status: number): string {
  try {
    const parsed = ErrorEnvelopeSchema.safeParse(JSON.parse(text));
    const msg = parsed.success ? parsed.data.message : undefined;
    return msg ?? `GitHub request failed (${status})`;
  } catch {
    return `GitHub request failed (${status})`;
  }
}

async function parseJson<T>(res: Response, schema: z.ZodType<T>): Promise<GithubApiResult<T>> {
  const text = await res.text();
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: extractError(text, res.status),
      authError: isAuthFailure(res.status, text),
    };
  }
  let raw: unknown;
  try {
    raw = text ? JSON.parse(text) : {};
  } catch {
    return { ok: false, status: 502, error: "GitHub returned non-JSON", authError: false };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, status: 502, error: "GitHub response shape invalid", authError: false };
  }
  return { ok: true, data: parsed.data };
}

async function ghGet<T>(
  ctx: GithubCallContext,
  path: string,
  schema: z.ZodType<T>,
): Promise<GithubApiResult<T>> {
  const res = await fetch(`${BASE}${path}`, {
    method: "GET",
    headers: headers(ctx),
    cache: "no-store",
  });
  return parseJson(res, schema);
}

async function ghSend<T>(
  ctx: GithubCallContext,
  method: "POST" | "PATCH",
  path: string,
  body: Record<string, unknown>,
  schema: z.ZodType<T>,
): Promise<GithubApiResult<T>> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { ...headers(ctx), "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  return parseJson(res, schema);
}

// ─── Response shapes (the subset each action reads) ────────────────────────────────

export const RepoSchema = z.object({
  full_name: z.string(),
  html_url: z.string(),
  default_branch: z.string(),
  private: z.boolean(),
});
export type GithubRepo = z.infer<typeof RepoSchema>;

const RefSchema = z.object({
  ref: z.string(),
  object: z.object({ sha: z.string() }),
});

const CommitSchema = z.object({
  sha: z.string(),
  tree: z.object({ sha: z.string() }),
});

const TreeSchema = z.object({ sha: z.string() });
const NewCommitSchema = z.object({ sha: z.string() });

export const PullRequestSchema = z.object({
  number: z.number(),
  html_url: z.string(),
  state: z.string(),
});
export type GithubPullRequest = z.infer<typeof PullRequestSchema>;

// ─── Repo ───────────────────────────────────────────────────────────────────────

/** Create a new repo on the authenticated owner's account. auto_init seeds a default branch. */
export function createRepo(
  ctx: GithubCallContext,
  params: { name: string; private: boolean; description?: string },
): Promise<GithubApiResult<GithubRepo>> {
  const body: Record<string, unknown> = {
    name: params.name,
    private: params.private,
    auto_init: true,
  };
  if (params.description) body.description = params.description;
  return ghSend(ctx, "POST", "/user/repos", body, RepoSchema);
}

// ─── Branch ─────────────────────────────────────────────────────────────────────

/** Resolve the head commit sha of a branch. 404 → the branch does not exist. */
export function getBranchHeadSha(
  ctx: GithubCallContext,
  owner: string,
  repo: string,
  branch: string,
): Promise<GithubApiResult<{ ref: string; object: { sha: string } }>> {
  return ghGet(
    ctx,
    `/repos/${enc(owner)}/${enc(repo)}/git/ref/heads/${encodeURIComponent(branch)}`,
    RefSchema,
  );
}

/** Create a new branch pointing at `sha`. */
export function createRef(
  ctx: GithubCallContext,
  owner: string,
  repo: string,
  branch: string,
  sha: string,
): Promise<GithubApiResult<{ ref: string; object: { sha: string } }>> {
  return ghSend(
    ctx,
    "POST",
    `/repos/${enc(owner)}/${enc(repo)}/git/refs`,
    { ref: `refs/heads/${branch}`, sha },
    RefSchema,
  );
}

// ─── Push files (Git Data API: tree → commit → ref) ───────────────────────────────

export type RepoFile = { path: string; content: string };

function getCommit(
  ctx: GithubCallContext,
  owner: string,
  repo: string,
  sha: string,
): Promise<GithubApiResult<{ sha: string; tree: { sha: string } }>> {
  return ghGet(ctx, `/repos/${enc(owner)}/${enc(repo)}/git/commits/${enc(sha)}`, CommitSchema);
}

function createTree(
  ctx: GithubCallContext,
  owner: string,
  repo: string,
  baseTree: string,
  files: RepoFile[],
): Promise<GithubApiResult<{ sha: string }>> {
  const tree = files.map((f) => ({
    path: f.path,
    mode: "100644" as const,
    type: "blob" as const,
    content: f.content,
  }));
  return ghSend(
    ctx,
    "POST",
    `/repos/${enc(owner)}/${enc(repo)}/git/trees`,
    { base_tree: baseTree, tree },
    TreeSchema,
  );
}

function createCommit(
  ctx: GithubCallContext,
  owner: string,
  repo: string,
  params: { message: string; tree: string; parent: string },
): Promise<GithubApiResult<{ sha: string }>> {
  return ghSend(
    ctx,
    "POST",
    `/repos/${enc(owner)}/${enc(repo)}/git/commits`,
    { message: params.message, tree: params.tree, parents: [params.parent] },
    NewCommitSchema,
  );
}

function updateRef(
  ctx: GithubCallContext,
  owner: string,
  repo: string,
  branch: string,
  sha: string,
): Promise<GithubApiResult<{ ref: string; object: { sha: string } }>> {
  return ghSend(
    ctx,
    "PATCH",
    `/repos/${enc(owner)}/${enc(repo)}/git/refs/heads/${encodeURIComponent(branch)}`,
    { sha, force: false },
    RefSchema,
  );
}

/**
 * Commit a set of files to `branch` as a single commit. Resolves the branch head, builds a tree on
 * top of it with the files inline, commits, and fast-forwards the ref. Returns the new commit sha.
 * Any step's failure short-circuits with that step's error (no partial ref update).
 */
export async function pushFilesToBranch(
  ctx: GithubCallContext,
  args: { owner: string; repo: string; branch: string; files: RepoFile[]; message: string },
): Promise<GithubApiResult<{ commitSha: string }>> {
  const head = await getBranchHeadSha(ctx, args.owner, args.repo, args.branch);
  if (!head.ok) return head;

  const baseCommit = await getCommit(ctx, args.owner, args.repo, head.data.object.sha);
  if (!baseCommit.ok) return baseCommit;

  const tree = await createTree(
    ctx,
    args.owner,
    args.repo,
    baseCommit.data.tree.sha,
    args.files,
  );
  if (!tree.ok) return tree;

  const commit = await createCommit(ctx, args.owner, args.repo, {
    message: args.message,
    tree: tree.data.sha,
    parent: head.data.object.sha,
  });
  if (!commit.ok) return commit;

  const moved = await updateRef(ctx, args.owner, args.repo, args.branch, commit.data.sha);
  if (!moved.ok) return moved;

  return { ok: true, data: { commitSha: commit.data.sha } };
}

// ─── Pull request ─────────────────────────────────────────────────────────────────

export function openPullRequest(
  ctx: GithubCallContext,
  owner: string,
  repo: string,
  params: { head: string; base: string; title: string; body?: string },
): Promise<GithubApiResult<GithubPullRequest>> {
  const body: Record<string, unknown> = {
    head: params.head,
    base: params.base,
    title: params.title,
  };
  if (params.body) body.body = params.body;
  return ghSend(ctx, "POST", `/repos/${enc(owner)}/${enc(repo)}/pulls`, body, PullRequestSchema);
}

function enc(segment: string): string {
  return encodeURIComponent(segment);
}
