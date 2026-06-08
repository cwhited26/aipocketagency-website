import { createClient } from "@/lib/supabase/server";
import { getProject, updateProject } from "@/lib/pa-projects";
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

  const result = await getProject(params.id, user.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  if (!result.data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ project: result.data });
}

const patchSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    goal: z.string().max(2000).nullable().optional(),
    instructions: z.string().max(20_000).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update" });

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
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
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 422 });

  const result = await updateProject(params.id, user.id, {
    ...(parsed.data.title !== undefined ? { title: parsed.data.title.trim() } : {}),
    ...(parsed.data.goal !== undefined ? { goal: parsed.data.goal?.trim() || null } : {}),
    ...(parsed.data.instructions !== undefined
      ? { instructions: parsed.data.instructions?.trim() || null }
      : {}),
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ project: result.data });
}
