// connectors/github-build/types.ts — shared vocabulary for the GitHub Build connector.
//
// This is the BUILD connector: the owner OAuths their GitHub with the `repo`, `workflow`, and
// `delete_repo` scopes so Pocket Agent can create repos, push code, branch, and open PRs on their
// account. It is deliberately DISTINCT from the brain-read GitHub access (a single-repo PAT used
// to read/write the owner's brain repo) — provider='github_build', its own pa_connections row.
//
// See lib/connectors/github-build/api.ts for the direct REST client (GitHub API v3, no Octokit).

// The approval gate for an action (same vocabulary as the Stripe connector, Connections Roadmap
// §2.4):
//   "gated"        — per-action approval; may graduate to auto-approve after the PA-ORCH-4 trust
//                    window (create_repo, create_branch, open_pull_request).
//   "always_gated" — per-action approval that NEVER becomes auto-approve eligible, regardless of
//                    success count (push_files). Writing code to a repo is the prime
//                    prompt-injection target (Build Tools SPEC §11), so the human reads the diff
//                    before every single push — there is no trust window that ever unlocks it.
export type ApprovalGate = "gated" | "always_gated";

export type GithubBuildActionName =
  | "create_repo"
  | "push_files"
  | "create_branch"
  | "open_pull_request";

// Listing shape for the UI / scope surfaces (name + gate, no executable bits).
export type GithubBuildActionMeta = {
  name: string;
  connector: "github_build";
  action: GithubBuildActionName;
  description: string;
  gate: ApprovalGate;
};

// Uniform outcome of executing an action, so the approve route handles every action the same way
// without `any`. `summary` is a human one-liner for the audit log + the chat readout.
export type ActionExecOutcome =
  | { ok: true; summary: string; data: Record<string, unknown> }
  | { ok: false; status: number; error: string; authError: boolean };
