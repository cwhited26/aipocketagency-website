// connectors/modal-sandbox/workspace.ts — records a spawned container's id back to its Project
// Workspace (Build Tools Roadmap §7.5 / §8.1, task item 5: "on spawnContainer success → record
// modal_container_id on the Project's Workspace row").
//
// Delegates to the Project Workspace data layer (lib/projects/workspace.ts, migration 045,
// PA-BUILD-8) — the canonical upsert the four build-connector lanes share. extendWorkspace touches
// only the modal_container_id column (on_conflict=project_id, merge-duplicates), so the Modal lane
// never clobbers the GitHub / Vercel / Supabase artifacts another lane wrote to the same row.
//
// BEST-EFFORT: a missing table or env returns recorded:false with a reason rather than failing an
// otherwise-successful spawn. The container exists either way; the workspace link is a convenience.

import { extendWorkspace } from "@/lib/projects/workspace";

export type WorkspaceRecordResult = { recorded: boolean; reason?: string };

/**
 * Record `modal_container_id` onto the Project's Workspace row. Returns recorded:false (with a
 * reason) instead of throwing when the workspace can't be written — a non-fatal convenience link.
 */
export async function recordContainerToWorkspace(input: {
  userId: string;
  projectId: string;
  containerId: string;
}): Promise<WorkspaceRecordResult> {
  try {
    const result = await extendWorkspace(input.projectId, input.userId, {
      modalContainerId: input.containerId,
    });
    if (result.ok) return { recorded: true };
    return {
      recorded: false,
      reason: `workspace write failed (${result.status}): ${result.error.slice(0, 160)}`,
    };
  } catch (e) {
    return { recorded: false, reason: e instanceof Error ? e.message : "workspace write failed" };
  }
}
