import { createClient } from "@/lib/supabase/server";
import { getProject } from "@/lib/pa-projects";
import { computeWorkspaceStatus, extendWorkspace, getWorkspace } from "@/lib/projects/workspace";
import { WORKSPACE_STATUSES } from "@/lib/projects/workspace-types";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET — the workspace row + computed status for a project. Returns workspace:null with an empty
// computed status when the project has provisioned nothing yet (the UI renders the empty state).
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Confirm the project belongs to the caller before exposing anything scoped to it.
  const projectResult = await getProject(params.id, user.id);
  if (!projectResult.ok) {
    return NextResponse.json({ error: projectResult.error }, { status: projectResult.status });
  }
  if (!projectResult.data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await getWorkspace(params.id, user.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({
    workspace: result.data,
    status: computeWorkspaceStatus(result.data),
  });
}

// The four downstream connector lanes (GitHub Build, Vercel, Supabase, Modal Sandbox) POST one of
// these as their provisioning action lands. Only the provided fields are written, so each lane extends
// the same workspace without clobbering another's artifact. At least one field must be present.
const extendSchema = z
  .object({
    githubRepoUrl: z.string().url().max(500).nullable().optional(),
    githubRepoFullName: z.string().max(300).nullable().optional(),
    vercelProjectId: z.string().max(200).nullable().optional(),
    vercelProjectName: z.string().max(200).nullable().optional(),
    supabaseProjectRef: z.string().max(100).nullable().optional(),
    supabaseProjectName: z.string().max(200).nullable().optional(),
    modalContainerId: z.string().max(200).nullable().optional(),
    status: z.enum(WORKSPACE_STATUSES).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No artifacts to write" });

// POST — create-or-extend the project's workspace with a new artifact reference.
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Ownership check first — guarantees the workspace row's project_id can only belong to this caller,
  // which is what makes the upsert-by-project_id safe against cross-tenant writes.
  const projectResult = await getProject(params.id, user.id);
  if (!projectResult.ok) {
    return NextResponse.json({ error: projectResult.error }, { status: projectResult.status });
  }
  if (!projectResult.data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    raw = {};
  }
  const parsed = extendSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 422 });

  const result = await extendWorkspace(params.id, user.id, parsed.data);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({
    workspace: result.data,
    status: computeWorkspaceStatus(result.data),
  });
}
