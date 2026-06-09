// GET    /api/app/skills/[slug]  — the rendered Skill detail: live SKILL.md + version history +
//                                  the triggered/ run log (proof it's being used).
// DELETE /api/app/skills/[slug]  — remove a Skill the owner no longer wants (they own the file).

import { NextResponse } from "next/server";
import { resolveOwnerSkillCtx } from "@/lib/skills/route-helpers";
import {
  deleteSkill,
  listSkillVersions,
  listTriggeredRecords,
  readSkill,
} from "@/lib/skills/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } },
): Promise<NextResponse> {
  const owner = await resolveOwnerSkillCtx();
  if (!owner.ok) return NextResponse.json({ error: owner.error }, { status: owner.status });

  const ctx = { repo: owner.repo, token: owner.token };
  const skill = await readSkill(ctx, params.slug);
  if (!skill) return NextResponse.json({ error: "Skill not found" }, { status: 404 });

  const [versions, triggered] = await Promise.all([
    listSkillVersions(ctx, params.slug),
    listTriggeredRecords(ctx, params.slug),
  ]);

  return NextResponse.json({
    frontmatter: skill.frontmatter,
    body: skill.body,
    versions,
    triggered,
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { slug: string } },
): Promise<NextResponse> {
  const owner = await resolveOwnerSkillCtx();
  if (!owner.ok) return NextResponse.json({ error: owner.error }, { status: owner.status });
  if (!owner.token) {
    return NextResponse.json({ error: "Connect your brain (GitHub) to manage Skills." }, { status: 409 });
  }

  const result = await deleteSkill({ repo: owner.repo, token: owner.token }, params.slug);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
  return NextResponse.json({ ok: true });
}
