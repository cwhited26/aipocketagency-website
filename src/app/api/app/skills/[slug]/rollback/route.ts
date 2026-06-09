// POST /api/app/skills/[slug]/rollback  — roll a Skill back to a prior version. Additive: it
// writes the old technique into a NEW version row (PA-SKILL-5), never a destructive overwrite.

import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveOwnerSkillCtx } from "@/lib/skills/route-helpers";
import { rollbackSkill } from "@/lib/skills/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ version: z.number().int().positive() });

export async function POST(
  req: Request,
  { params }: { params: { slug: string } },
): Promise<NextResponse> {
  const owner = await resolveOwnerSkillCtx();
  if (!owner.ok) return NextResponse.json({ error: owner.error }, { status: owner.status });
  if (!owner.token) {
    return NextResponse.json({ error: "Connect your brain (GitHub) to manage Skills." }, { status: 409 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 422 });

  const result = await rollbackSkill(
    { repo: owner.repo, token: owner.token },
    params.slug,
    parsed.data.version,
    new Date().toISOString(),
  );
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
  return NextResponse.json({ ok: true, version: result.version });
}
