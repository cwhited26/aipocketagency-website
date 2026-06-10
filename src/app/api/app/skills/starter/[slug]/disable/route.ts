// POST /api/app/skills/starter/[slug]/disable — turn a starter skill off (or back on) for this owner
// (PA-STARTERSKILL-6). A disabled skill stops loading into runs (the dispatcher reads the override
// before planning) without deleting the brain file. Body: { disabled: boolean }.

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { starterSkillBySlug } from "@/lib/starter-skills/catalog";
import { setStarterSkillDisabled } from "@/lib/starter-skills/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ disabled: z.boolean() });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  if (!starterSkillBySlug(slug)) {
    return NextResponse.json({ error: "Unknown skill" }, { status: 404 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 422 });

  const res = await setStarterSkillDisabled({
    ownerId: user.id,
    skillSlug: slug,
    disabled: parsed.data.disabled,
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 502 });

  return NextResponse.json({ slug, disabled: parsed.data.disabled });
}
