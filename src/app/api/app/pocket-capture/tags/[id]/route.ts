// /api/app/pocket-capture/tags/[id] — mutate one Captures Dashboard tag (migration 097).
//   PATCH  { name?, colorHex? } → rename and/or recolor (color snapped to the 12-color palette).
//   DELETE                      → remove the tab (a capture's tags[] is untouched; the name just
//                                 stops matching a tab). Owner-scoped via the session.

import { createClient } from "@/lib/supabase/server";
import { updateTag, deleteTag } from "@/lib/pocket-capture/tags-db";
import { PALETTE_HEXES } from "@/lib/pocket-capture/tags";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireUser(): Promise<{ ok: true; userId: string } | { ok: false; response: NextResponse }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { ok: true, userId: user.id };
}

const patchSchema = z
  .object({
    name: z.string().min(1).max(40).optional(),
    colorHex: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .refine((c) => PALETTE_HEXES.some((h) => h.toLowerCase() === c.toLowerCase()), "Pick a palette color.")
      .optional(),
  })
  .refine((p) => p.name !== undefined || p.colorHex !== undefined, "Provide name and/or colorHex.");

export async function PATCH(req: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid update" }, { status: 422 });

  const result = await updateTag(params.id, auth.userId, parsed.data);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ tag: result.data });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const result = await deleteTag(params.id, auth.userId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  if (!result.data.deleted) return NextResponse.json({ error: "Tag not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
