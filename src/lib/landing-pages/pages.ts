// pages.ts — Landing Page CRUD (pa_landing_pages, migration 064). Service-role PostgREST scoped by
// owner_id, matching the Lead Scout / Projects data layer. The row holds the page's template, the
// persisted generation (copy + files), the GitHub + Vercel artifacts, and the build cursor.

import type {
  BuildStep,
  DesignSystemSnapshot,
  GeneratedBundle,
  LandingPageRow,
  LandingPageStatus,
  LandingPageView,
} from "./types";
import { isTemplateId } from "./types";
import { isDirectionRef } from "./directions";

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
function writeHeaders(key: string): Record<string, string> {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

const TABLE = "pa_landing_pages";

export async function listPages(ownerId: string): Promise<PaResult<LandingPageRow[]>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const endpoint =
    `${env.url}/rest/v1/${TABLE}` +
    `?owner_id=eq.${encodeURIComponent(ownerId)}&order=updated_at.desc&limit=100`;
  const res = await fetch(endpoint, { headers: readHeaders(env.key), cache: "no-store" });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: (await res.json()) as LandingPageRow[] };
}

export async function getPage(id: string, ownerId: string): Promise<PaResult<LandingPageRow | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const endpoint =
    `${env.url}/rest/v1/${TABLE}` +
    `?id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(ownerId)}&limit=1`;
  const res = await fetch(endpoint, { headers: readHeaders(env.key), cache: "no-store" });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as LandingPageRow[];
  return { ok: true, data: rows[0] ?? null };
}

export async function createPage(params: {
  ownerId: string;
  title: string;
  description: string;
  /** A starter template id or a gallery direction ref (validated by the route before this runs). */
  template: string;
  projectId?: string | null;
  /** Repo-relative scope path (sanitized by the route); null = owner brain root (PA-LPB-7). */
  brainScope?: string | null;
  /** Domain from scope's brand.json, read at create-time (PA-LPB-9). Null = none found. */
  brainScopeDomain?: string | null;
  /** Moonchild DS reference (PA-LPB-10, migration 080). */
  designSystemId?: string | null;
  designSystemImportedFrom?: string | null;
  designSystemSnapshot?: DesignSystemSnapshot | null;
}): Promise<PaResult<LandingPageRow>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(`${env.url}/rest/v1/${TABLE}`, {
    method: "POST",
    headers: writeHeaders(env.key),
    body: JSON.stringify({
      owner_id: params.ownerId,
      title: params.title,
      description: params.description,
      template: params.template,
      project_id: params.projectId ?? null,
      brain_scope: params.brainScope ?? null,
      brain_scope_domain: params.brainScopeDomain ?? null,
      design_system_id: params.designSystemId ?? null,
      design_system_imported_from: params.designSystemImportedFrom ?? null,
      design_system_snapshot: params.designSystemSnapshot ?? null,
      status: "planning",
      build_step: "plan",
    }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as LandingPageRow[];
  if (!rows[0]) return { ok: false, status: 500, error: "No landing page row returned" };
  return { ok: true, data: rows[0] };
}

export type LandingPagePatch = {
  title?: string;
  description?: string;
  status?: LandingPageStatus;
  buildStep?: BuildStep;
  generatedCopy?: GeneratedBundle;
  githubRepoName?: string | null;
  vercelProjectId?: string | null;
  vercelUrl?: string | null;
  customDomain?: string | null;
  brainScope?: string | null;
  designSystemId?: string | null;
  designSystemImportedFrom?: string | null;
  designSystemSnapshot?: DesignSystemSnapshot | null;
};

export async function updatePage(
  id: string,
  ownerId: string,
  patch: LandingPagePatch,
): Promise<PaResult<LandingPageRow>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const body: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) body.title = patch.title;
  if (patch.description !== undefined) body.description = patch.description;
  if (patch.status !== undefined) body.status = patch.status;
  if (patch.buildStep !== undefined) body.build_step = patch.buildStep;
  if (patch.generatedCopy !== undefined) body.generated_copy = patch.generatedCopy;
  if (patch.githubRepoName !== undefined) body.github_repo_name = patch.githubRepoName;
  if (patch.vercelProjectId !== undefined) body.vercel_project_id = patch.vercelProjectId;
  if (patch.vercelUrl !== undefined) body.vercel_url = patch.vercelUrl;
  if (patch.customDomain !== undefined) body.custom_domain = patch.customDomain;
  if (patch.brainScope !== undefined) body.brain_scope = patch.brainScope;
  if (patch.designSystemId !== undefined) body.design_system_id = patch.designSystemId;
  if (patch.designSystemImportedFrom !== undefined) body.design_system_imported_from = patch.designSystemImportedFrom;
  if (patch.designSystemSnapshot !== undefined) body.design_system_snapshot = patch.designSystemSnapshot;

  const endpoint =
    `${env.url}/rest/v1/${TABLE}` +
    `?id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(ownerId)}`;
  const res = await fetch(endpoint, {
    method: "PATCH",
    headers: writeHeaders(env.key),
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as LandingPageRow[];
  if (!rows[0]) return { ok: false, status: 404, error: "Landing page not found" };
  return { ok: true, data: rows[0] };
}

export async function deletePage(id: string, ownerId: string): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const endpoint =
    `${env.url}/rest/v1/${TABLE}` +
    `?id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(ownerId)}`;
  const res = await fetch(endpoint, {
    method: "DELETE",
    headers: { ...readHeaders(env.key), Prefer: "return=minimal" },
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}

/** The trimmed, client-safe view of a page row (drops the internal generation blob). */
export function toView(row: LandingPageRow): LandingPageView {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    template: isTemplateId(row.template) || isDirectionRef(row.template) ? row.template : "single-cta",
    brainScope: row.brain_scope ?? null,
    hasDesignSystem: Boolean(row.design_system_id || row.design_system_snapshot),
    designSystemImportedFrom: row.design_system_imported_from ?? null,
    status: row.status,
    buildStep: row.build_step,
    githubRepoName: row.github_repo_name,
    vercelUrl: row.vercel_url,
    customDomain: row.custom_domain,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
