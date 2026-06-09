// connectors/vercel/workspace.ts — record a freshly-created Vercel project back to its Project
// Workspace (Build Tools Roadmap §7.5 / §8.1; deliverable: createProject → workspace gets
// vercel_project_id + vercel_project_name).
//
// The Project Workspace primitive (pa_project_workspaces, migration 045, PA-BUILD-8) is owned by the
// Workspace lane. It exposes the write two ways: POST /api/app/projects/<id>/workspace (browser,
// owner session) and the underlying extendWorkspace() data-layer call. This connector executes
// server-side inside the approval route — it has no owner session cookie, so it calls
// extendWorkspace() directly (service-role, the same write the POST route performs) rather than the
// cookie-authed HTTP endpoint, which a server-to-server fetch could never authenticate against. This
// mirrors the GitHub Build / Modal Sandbox lanes' workspace wrappers exactly.
//
// extendWorkspace touches only the vercel_* columns (on_conflict=project_id, merge-duplicates), so
// the Vercel lane never clobbers the GitHub repo / Supabase ref / Modal container another lane wrote
// to the same row. Best-effort: the outcome is RETURNED (never swallowed) so the executor folds
// "linked" vs "link deferred" into the action summary — no silent catch, and a workspace-write hiccup
// never fails an otherwise-successful project creation.

import { extendWorkspace } from "@/lib/projects/workspace";

export type WorkspaceLinkResult = { linked: true } | { linked: false; reason: string };

/**
 * Record a created Vercel project on its Project Workspace. `ownerUserId` scopes the write (the
 * workspace row's project_id must belong to this owner). Returns a discriminated result; never throws.
 */
export async function linkVercelProjectToWorkspace(args: {
  projectId: string;
  ownerUserId: string;
  vercelProjectId: string;
  vercelProjectName: string | null;
}): Promise<WorkspaceLinkResult> {
  try {
    const res = await extendWorkspace(args.projectId, args.ownerUserId, {
      vercelProjectId: args.vercelProjectId,
      vercelProjectName: args.vercelProjectName,
    });
    return res.ok ? { linked: true } : { linked: false, reason: res.error };
  } catch (err) {
    return {
      linked: false,
      reason: err instanceof Error ? err.message : "workspace write failed",
    };
  }
}
