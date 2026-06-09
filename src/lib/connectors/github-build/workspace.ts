// connectors/github-build/workspace.ts — link a freshly-created repo back to its Project Workspace.
//
// Build Tools SPEC §7.5 / §8.1: a Project Workspace (pa_project_workspaces) ties every artifact a
// single Project plan provisioned (repo, deploy, database, container) into one record. When
// create_repo lands for a Project, the repo URL + full name are written back to that Project's
// workspace row.
//
// The Workspace lane exposes this write two ways: POST /api/app/projects/<id>/workspace (browser,
// owner session) and the underlying extendWorkspace() data-layer call. This connector executes
// server-side inside the approval route — it has no owner session cookie, so it calls
// extendWorkspace() directly (service-role, the same write the POST route performs) rather than the
// cookie-authed HTTP endpoint, which a server-to-server fetch could never authenticate against.
//
// Best-effort: the outcome is RETURNED (never swallowed) so the executor folds "linked" vs "link
// deferred" into the action summary the owner sees — no silent catch, and a workspace-write hiccup
// never fails an otherwise-successful repo creation.

import { extendWorkspace } from "@/lib/projects/workspace";

export type WorkspaceLinkResult = { linked: true } | { linked: false; reason: string };

/**
 * Record a created repo on its Project Workspace. `ownerUserId` scopes the write (the workspace
 * row's project_id must belong to this owner). Returns a discriminated result; never throws.
 */
export async function linkRepoToWorkspace(args: {
  projectId: string;
  ownerUserId: string;
  githubRepoUrl: string;
  githubRepoFullName: string;
}): Promise<WorkspaceLinkResult> {
  try {
    const res = await extendWorkspace(args.projectId, args.ownerUserId, {
      githubRepoUrl: args.githubRepoUrl,
      githubRepoFullName: args.githubRepoFullName,
    });
    return res.ok ? { linked: true } : { linked: false, reason: res.error };
  } catch (err) {
    return {
      linked: false,
      reason: err instanceof Error ? err.message : "workspace write failed",
    };
  }
}
