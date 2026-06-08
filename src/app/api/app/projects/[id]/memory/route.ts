import { createClient } from "@/lib/supabase/server";
import { getProject, listProjectMemory, addProjectMemory } from "@/lib/pa-projects";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await listProjectMemory(params.id, user.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ memory: result.data });
}

const addSchema = z.object({ body: z.string().min(1).max(10_000) });

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Confirm the project is the owner's before writing scoped memory into it.
  const project = await getProject(params.id, user.id);
  if (!project.ok) return NextResponse.json({ error: project.error }, { status: project.status });
  if (!project.data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    raw = {};
  }
  const parsed = addSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 422 });

  const result = await addProjectMemory(params.id, user.id, parsed.data.body.trim());
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ entry: result.data }, { status: 201 });
}
