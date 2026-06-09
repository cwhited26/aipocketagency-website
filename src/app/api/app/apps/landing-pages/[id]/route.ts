// GET    /api/app/apps/landing-pages/[id]  — read one page
// PATCH  /api/app/apps/landing-pages/[id]  — { customDomain }  → stage a Vercel attachDomain approval
//                                            (live pages only); or { title, description } edits
// DELETE /api/app/apps/landing-pages/[id]  — remove a page

import { createClient } from "@/lib/supabase/server";
import { deletePage, getPage, toView, updatePage } from "@/lib/landing-pages/pages";
import { stageCustomDomain } from "@/lib/landing-pages/advance";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  customDomain: z
    .string()
    .min(3)
    .max(253)
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, "Enter a valid domain like get.example.com.")
    .optional(),
  title: z.string().min(1).max(120).optional(),
  description: z.string().min(1).max(4000).optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const found = await getPage(params.id, user.id);
  if (!found.ok) return NextResponse.json({ error: found.error }, { status: found.status });
  if (!found.data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ page: toView(found.data) });
}

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
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 422 });

  const found = await getPage(params.id, user.id);
  if (!found.ok) return NextResponse.json({ error: found.error }, { status: found.status });
  if (!found.data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // A custom domain stages a Vercel attachDomain approval (single-approval forever); it doesn't write
  // the domain until the owner approves and the build advances.
  if (parsed.data.customDomain) {
    const staged = await stageCustomDomain({
      page: found.data,
      ownerId: user.id,
      domain: parsed.data.customDomain,
    });
    if (!staged.ok) return NextResponse.json({ error: staged.error }, { status: staged.status });
    return NextResponse.json({ staged: true });
  }

  if (parsed.data.title !== undefined || parsed.data.description !== undefined) {
    const updated = await updatePage(params.id, user.id, {
      title: parsed.data.title,
      description: parsed.data.description,
    });
    if (!updated.ok) return NextResponse.json({ error: updated.error }, { status: updated.status });
    return NextResponse.json({ page: toView(updated.data) });
  }

  return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const removed = await deletePage(params.id, user.id);
  if (!removed.ok) return NextResponse.json({ error: removed.error }, { status: removed.status });
  return NextResponse.json({ deleted: true });
}
