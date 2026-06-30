// /api/app/pocket-capture/tags — the owner's Captures Dashboard tab definitions (migration 097).
//   GET    → list the owner's tags in tab order, seeding the four defaults on first use.
//   POST   { name, colorHex }        → create a tag (color snapped to the 12-color palette).
//   PATCH  { order: string[] }       → reorder the whole tab strip to match the drag result.
// Owner-scoped via the session; all writes go through the service-role data layer in tags-db.ts.

import { createClient } from "@/lib/supabase/server";
import { listTagsWithSeed, createTag, reorderTags } from "@/lib/pocket-capture/tags-db";
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

export async function GET(): Promise<NextResponse> {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const result = await listTagsWithSeed(auth.userId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ tags: result.data });
}

const colorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a #rrggbb hex.")
  .refine((c) => PALETTE_HEXES.some((h) => h.toLowerCase() === c.toLowerCase()), "Pick a palette color.");

const createSchema = z.object({
  name: z.string().min(1).max(40),
  colorHex: colorSchema,
});

const reorderSchema = z.object({
  order: z.array(z.string().min(1)).max(50),
});

export async function POST(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid tag" }, { status: 422 });

  const result = await createTag(auth.userId, parsed.data.name, parsed.data.colorHex);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ tag: result.data }, { status: 201 });
}

export async function PATCH(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = reorderSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Body must be { order: string[] }" }, { status: 422 });

  const result = await reorderTags(auth.userId, parsed.data.order);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ tags: result.data });
}
