import { createClient } from "@/lib/supabase/server";
import { listProjects, createProject } from "@/lib/pa-projects";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await listProjects(user.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ projects: result.data });
}

const createSchema = z.object({
  title: z.string().min(1).max(200),
  goal: z.string().max(2000).optional(),
  instructions: z.string().max(20_000).optional(),
});

export async function POST(req: Request): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    raw = {};
  }
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 422 });

  const result = await createProject(user.id, {
    title: parsed.data.title.trim(),
    goal: parsed.data.goal?.trim() || null,
    instructions: parsed.data.instructions?.trim() || null,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ project: result.data }, { status: 201 });
}
