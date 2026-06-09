// Project Workspace data layer (migration 045, PA-BUILD-7 / PA-BUILD-8).
//
// Reads and writes pa_project_workspaces — the single record of every artifact a build Project
// provisioned. Every call goes through PostgREST with the service-role key scoped by owner_id, the
// same pattern as pa-projects.ts. The four downstream connector lanes (GitHub Build, Vercel, Supabase,
// Modal Sandbox) call extendWorkspace() as each provisioning action lands; the Projects-tab Workspace
// panel calls getWorkspace() to render the artifacts as live links.

import {
  WORKSPACE_ARTIFACT_TOTAL,
  type ComputedWorkspaceStatus,
  type ProjectWorkspace,
  type WorkspaceArtifactPatch,
} from "./workspace-types";

type PaResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

function paEnv(): { url: string; key: string } | { error: string } {
  const url =
    process.env.POCKET_AGENT_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.WC_ADMIN_SUPABASE_URL;
  const key =
    process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.WC_ADMIN_SUPABASE_SERVICE_KEY;
  if (!url || !key) return { error: "Supabase env vars not set" };
  return { url: url.replace(/\/$/, ""), key };
}

function readHeaders(key: string): Record<string, string> {
  return { apikey: key, Authorization: `Bearer ${key}` };
}

// ── Reads ─────────────────────────────────────────────────────────────────────

// The workspace row for a project, or null when the project has provisioned nothing yet (the UI
// renders the empty state for null). Scoped by owner_id so a workspace only resolves for its owner.
export async function getWorkspace(
  projectId: string,
  ownerId: string,
): Promise<PaResult<ProjectWorkspace | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const endpoint =
    `${env.url}/rest/v1/pa_project_workspaces` +
    `?project_id=eq.${encodeURIComponent(projectId)}&owner_id=eq.${encodeURIComponent(ownerId)}` +
    `&limit=1`;
  const res = await fetch(endpoint, { headers: readHeaders(env.key), cache: "no-store" });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as ProjectWorkspace[];
  return { ok: true, data: rows[0] ?? null };
}

// ── Writes ──────────────────────────────────────────────────────────────────────

// Maps a camelCase patch to the snake_case row columns, dropping undefined keys so an extend only
// touches the artifacts the caller actually provisioned.
function patchToColumns(patch: WorkspaceArtifactPatch): Record<string, unknown> {
  const cols: Record<string, unknown> = {};
  if (patch.githubRepoUrl !== undefined) cols.github_repo_url = patch.githubRepoUrl;
  if (patch.githubRepoFullName !== undefined) cols.github_repo_full_name = patch.githubRepoFullName;
  if (patch.vercelProjectId !== undefined) cols.vercel_project_id = patch.vercelProjectId;
  if (patch.vercelProjectName !== undefined) cols.vercel_project_name = patch.vercelProjectName;
  if (patch.supabaseProjectRef !== undefined) cols.supabase_project_ref = patch.supabaseProjectRef;
  if (patch.supabaseProjectName !== undefined) cols.supabase_project_name = patch.supabaseProjectName;
  if (patch.modalContainerId !== undefined) cols.modal_container_id = patch.modalContainerId;
  if (patch.status !== undefined) cols.status = patch.status;
  return cols;
}

// Create-or-extend the workspace for a project. Each connector lane calls this as its artifact lands;
// the upsert (on_conflict=project_id, merge-duplicates) means four lanes firing in parallel each extend
// the one row instead of racing to create duplicates, and only the provided fields are written so a
// later lane never clobbers an earlier lane's artifact. Cross-tenant safety is enforced upstream: the
// API route confirms the project belongs to the caller before passing their ownerId here.
export async function extendWorkspace(
  projectId: string,
  ownerId: string,
  patch: WorkspaceArtifactPatch,
): Promise<PaResult<ProjectWorkspace>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const body = {
    project_id: projectId,
    owner_id: ownerId,
    ...patchToColumns(patch),
    updated_at: new Date().toISOString(),
  };

  const res = await fetch(
    `${env.url}/rest/v1/pa_project_workspaces?on_conflict=project_id`,
    {
      method: "POST",
      headers: {
        ...readHeaders(env.key),
        "Content-Type": "application/json",
        Prefer: "return=representation,resolution=merge-duplicates",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as ProjectWorkspace[];
  const row = rows[0];
  if (!row) return { ok: false, status: 500, error: "No row returned" };
  return { ok: true, data: row };
}

// ── Computed status ──────────────────────────────────────────────────────────────

// The per-artifact readiness view the panel renders ("X of 4 provisioned"), plus the stored lifecycle
// label. For a project with no workspace row yet, pass null → everything reads empty / provisioning.
export function computeWorkspaceStatus(
  workspace: ProjectWorkspace | null,
): ComputedWorkspaceStatus {
  const artifacts = {
    github: Boolean(workspace?.github_repo_url),
    vercel: Boolean(workspace?.vercel_project_id),
    supabase: Boolean(workspace?.supabase_project_ref),
    modal: Boolean(workspace?.modal_container_id),
  };
  const provisionedCount = Object.values(artifacts).filter(Boolean).length;
  return {
    stored: workspace?.status ?? "provisioning",
    artifacts,
    provisionedCount,
    total: WORKSPACE_ARTIFACT_TOTAL,
    allProvisioned: provisionedCount === WORKSPACE_ARTIFACT_TOTAL,
  };
}
