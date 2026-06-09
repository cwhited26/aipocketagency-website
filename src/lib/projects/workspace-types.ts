// Project Workspace primitive — shared types (migration 045, PA-BUILD-7 / PA-BUILD-8).
//
// A workspace ties a build Project to the artifacts it provisioned across four providers (GitHub
// repo, Vercel project, Supabase project, Modal container). The row is written by the four downstream
// connector lanes as their provisioning actions land, and read by the Projects-tab Workspace panel.
// See APA/Products/Pocket_Agent_Build_Tools_Roadmap_v0_1.md §7.5 + §8.1.

// Lifecycle label stored on the row. Authoritative for the overall state of the build; the per-artifact
// "X of 4 provisioned" view is computed from the artifact columns (see ComputedWorkspaceStatus). The
// tuple is the single source of truth — the type derives from it and the API's zod enum reuses it, so
// the CHECK constraint in migration 045, this type, and request validation never drift.
export const WORKSPACE_STATUSES = ["provisioning", "live", "failed", "archived"] as const;

export type WorkspaceStatus = (typeof WORKSPACE_STATUSES)[number];

// One row of pa_project_workspaces — the single record of every artifact a Project plan provisioned.
export type ProjectWorkspace = {
  id: string;
  project_id: string;
  owner_id: string;
  github_repo_url: string | null;
  github_repo_full_name: string | null;
  vercel_project_id: string | null;
  vercel_project_name: string | null;
  supabase_project_ref: string | null;
  supabase_project_name: string | null;
  modal_container_id: string | null;
  status: WorkspaceStatus;
  created_at: string;
  updated_at: string;
};

// Partial extend payload. The four connector lanes POST one of these as their artifact lands; an
// existing workspace is patched in place (only the provided fields change), a missing one is created.
export type WorkspaceArtifactPatch = {
  githubRepoUrl?: string | null;
  githubRepoFullName?: string | null;
  vercelProjectId?: string | null;
  vercelProjectName?: string | null;
  supabaseProjectRef?: string | null;
  supabaseProjectName?: string | null;
  modalContainerId?: string | null;
  status?: WorkspaceStatus;
};

// Which of the four artifacts have been provisioned. Derived from the workspace row's columns.
export type WorkspaceArtifactSummary = {
  github: boolean;
  vercel: boolean;
  supabase: boolean;
  modal: boolean;
};

export const WORKSPACE_ARTIFACT_TOTAL = 4;

// Computed status the API returns alongside the row — the stored lifecycle label plus the per-artifact
// readiness view the panel renders ("2 of 4 provisioned").
export type ComputedWorkspaceStatus = {
  stored: WorkspaceStatus;
  artifacts: WorkspaceArtifactSummary;
  provisionedCount: number;
  total: number;
  allProvisioned: boolean;
};
