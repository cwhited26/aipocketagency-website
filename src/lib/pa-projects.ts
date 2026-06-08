// Projects data layer (migration 035). A project is both an execution unit (goal + plan + tasks +
// approvals, backed by a brain scaffold) AND a context container: per-project Instructions, scoped
// memory, reference docs, and linked conversations. Every read/write goes through PostgREST with
// the service-role key scoped by owner_id — the same pattern as pa-conversations.ts.

export type Project = {
  id: string;
  owner_id: string;
  title: string;
  goal: string | null;
  instructions: string | null;
  scaffold_slug: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectMemoryEntry = {
  id: string;
  project_id: string;
  owner_id: string;
  body: string;
  created_at: string;
};

export type ProjectReference = {
  id: string;
  project_id: string;
  owner_id: string;
  file_path: string | null;
  file_name: string;
  content_text: string;
  created_at: string;
};

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

// ── Projects ────────────────────────────────────────────────────────────────

export async function listProjects(ownerId: string): Promise<PaResult<Project[]>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const endpoint =
    `${env.url}/rest/v1/pa_projects` +
    `?owner_id=eq.${encodeURIComponent(ownerId)}&order=updated_at.desc&limit=100`;
  const res = await fetch(endpoint, { headers: readHeaders(env.key), cache: "no-store" });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: (await res.json()) as Project[] };
}

export async function getProject(id: string, ownerId: string): Promise<PaResult<Project | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const endpoint =
    `${env.url}/rest/v1/pa_projects` +
    `?id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(ownerId)}&limit=1`;
  const res = await fetch(endpoint, { headers: readHeaders(env.key), cache: "no-store" });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as Project[];
  return { ok: true, data: rows[0] ?? null };
}

export async function createProject(
  ownerId: string,
  fields: { title: string; goal?: string | null; instructions?: string | null; scaffoldSlug?: string | null },
): Promise<PaResult<Project>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(`${env.url}/rest/v1/pa_projects`, {
    method: "POST",
    headers: writeHeaders(env.key),
    body: JSON.stringify({
      owner_id: ownerId,
      title: fields.title,
      goal: fields.goal ?? null,
      instructions: fields.instructions ?? null,
      scaffold_slug: fields.scaffoldSlug ?? null,
    }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as Project[];
  const row = rows[0];
  if (!row) return { ok: false, status: 500, error: "No row returned" };
  return { ok: true, data: row };
}

export async function updateProject(
  id: string,
  ownerId: string,
  patch: { title?: string; goal?: string | null; instructions?: string | null; scaffoldSlug?: string | null },
): Promise<PaResult<Project>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const body: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) body.title = patch.title;
  if (patch.goal !== undefined) body.goal = patch.goal;
  if (patch.instructions !== undefined) body.instructions = patch.instructions;
  if (patch.scaffoldSlug !== undefined) body.scaffold_slug = patch.scaffoldSlug;

  const endpoint =
    `${env.url}/rest/v1/pa_projects` +
    `?id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(ownerId)}`;
  const res = await fetch(endpoint, {
    method: "PATCH",
    headers: writeHeaders(env.key),
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as Project[];
  const row = rows[0];
  if (!row) return { ok: false, status: 404, error: "Project not found" };
  return { ok: true, data: row };
}

// ── Project memory ────────────────────────────────────────────────────────────

export async function listProjectMemory(
  projectId: string,
  ownerId: string,
): Promise<PaResult<ProjectMemoryEntry[]>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const endpoint =
    `${env.url}/rest/v1/pa_project_memory` +
    `?project_id=eq.${encodeURIComponent(projectId)}&owner_id=eq.${encodeURIComponent(ownerId)}` +
    `&order=created_at.desc`;
  const res = await fetch(endpoint, { headers: readHeaders(env.key), cache: "no-store" });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: (await res.json()) as ProjectMemoryEntry[] };
}

export async function addProjectMemory(
  projectId: string,
  ownerId: string,
  body: string,
): Promise<PaResult<ProjectMemoryEntry>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(`${env.url}/rest/v1/pa_project_memory`, {
    method: "POST",
    headers: writeHeaders(env.key),
    body: JSON.stringify({ project_id: projectId, owner_id: ownerId, body }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as ProjectMemoryEntry[];
  const row = rows[0];
  if (!row) return { ok: false, status: 500, error: "No row returned" };
  return { ok: true, data: row };
}

export async function deleteProjectMemory(
  id: string,
  projectId: string,
  ownerId: string,
): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const endpoint =
    `${env.url}/rest/v1/pa_project_memory` +
    `?id=eq.${encodeURIComponent(id)}&project_id=eq.${encodeURIComponent(projectId)}` +
    `&owner_id=eq.${encodeURIComponent(ownerId)}`;
  const res = await fetch(endpoint, {
    method: "DELETE",
    headers: { ...readHeaders(env.key), Prefer: "return=minimal" },
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}

// ── Project references ──────────────────────────────────────────────────────────

export async function listProjectReferences(
  projectId: string,
  ownerId: string,
): Promise<PaResult<ProjectReference[]>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const endpoint =
    `${env.url}/rest/v1/pa_project_references` +
    `?project_id=eq.${encodeURIComponent(projectId)}&owner_id=eq.${encodeURIComponent(ownerId)}` +
    `&order=created_at.desc`;
  const res = await fetch(endpoint, { headers: readHeaders(env.key), cache: "no-store" });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: (await res.json()) as ProjectReference[] };
}

export async function addProjectReference(
  projectId: string,
  ownerId: string,
  fields: { fileName: string; contentText: string; filePath?: string | null },
): Promise<PaResult<ProjectReference>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(`${env.url}/rest/v1/pa_project_references`, {
    method: "POST",
    headers: writeHeaders(env.key),
    body: JSON.stringify({
      project_id: projectId,
      owner_id: ownerId,
      file_name: fields.fileName,
      content_text: fields.contentText,
      file_path: fields.filePath ?? null,
    }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as ProjectReference[];
  const row = rows[0];
  if (!row) return { ok: false, status: 500, error: "No row returned" };
  return { ok: true, data: row };
}

export async function deleteProjectReference(
  id: string,
  projectId: string,
  ownerId: string,
): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const endpoint =
    `${env.url}/rest/v1/pa_project_references` +
    `?id=eq.${encodeURIComponent(id)}&project_id=eq.${encodeURIComponent(projectId)}` +
    `&owner_id=eq.${encodeURIComponent(ownerId)}`;
  const res = await fetch(endpoint, {
    method: "DELETE",
    headers: { ...readHeaders(env.key), Prefer: "return=minimal" },
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}

// ── Project context block ───────────────────────────────────────────────────────

// Builds the project-scoped context that prepends to every linked conversation's system prompt —
// the Instructions rulebook, the reference docs, and the saved project memory. Returns "" when the
// project has no context worth injecting so the agent prompt stays clean. References and memory are
// clipped so a large project can't blow the context budget.
const MAX_REFERENCE_CHARS = 4000;
const MAX_MEMORY_ENTRIES = 30;

export async function buildProjectContextBlock(
  projectId: string,
  ownerId: string,
): Promise<{ block: string; project: Project } | null> {
  const projectResult = await getProject(projectId, ownerId);
  if (!projectResult.ok || !projectResult.data) return null;
  const project = projectResult.data;

  const [refsResult, memResult] = await Promise.all([
    listProjectReferences(projectId, ownerId),
    listProjectMemory(projectId, ownerId),
  ]);
  const references = refsResult.ok ? refsResult.data : [];
  const memory = memResult.ok ? memResult.data.slice(0, MAX_MEMORY_ENTRIES) : [];

  const sections: string[] = [
    `You are working inside the project "${project.title}". Everything below is project-scoped — it applies to this conversation and stays with this project; it is NOT part of the owner's global brain.`,
  ];

  if (project.goal && project.goal.trim()) {
    sections.push(`PROJECT GOAL:\n${project.goal.trim()}`);
  }

  if (project.instructions && project.instructions.trim()) {
    sections.push(`PROJECT INSTRUCTIONS (the rulebook for this project — follow these):\n${project.instructions.trim()}`);
  }

  if (references.length > 0) {
    const refBlocks = references.map((r) => {
      const text =
        r.content_text.length > MAX_REFERENCE_CHARS
          ? `${r.content_text.slice(0, MAX_REFERENCE_CHARS)}\n…[reference truncated]`
          : r.content_text;
      return `--- ${r.file_name} ---\n${text}`;
    });
    sections.push(`PROJECT REFERENCE FILES (uploaded docs every conversation in this project can read):\n${refBlocks.join("\n\n")}`);
  }

  if (memory.length > 0) {
    const memLines = memory.map((m) => `- ${m.body}`);
    sections.push(`PROJECT MEMORY (notes saved while working in this project — recall and build on these):\n${memLines.join("\n")}`);
  }

  // When the project carries no instructions, references, or memory there is nothing to anchor on,
  // so skip the block entirely rather than inject a bare "you're in project X" line.
  if (sections.length === 1 && !project.goal?.trim()) return { block: "", project };

  return { block: sections.join("\n\n"), project };
}
