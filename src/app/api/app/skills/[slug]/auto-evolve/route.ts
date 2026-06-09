// POST /api/app/skills/[slug]/auto-evolve  — flip the per-Skill auto-evolve toggle (PA-SKILL-3).
// With it on, the LEARN phase sharpens THIS Skill on its own (still version-rowed + a passive
// notice), never a new Skill and never global.

import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveOwnerSkillCtx } from "@/lib/skills/route-helpers";
import { readSkill, setAutoEvolve } from "@/lib/skills/store";
import { autoEvolveTrustThreshold } from "@/lib/skills/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ enabled: z.boolean() });

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

  const ctx = { repo: owner.repo, token: owner.token };

  // Trust window: auto-evolve only unlocks after the owner has approved enough evolution proposals
  // for this Skill (PA-ORCH-4 pattern). Enabling before the window is closed is refused.
  if (parsed.data.enabled) {
    const skill = await readSkill(ctx, params.slug);
    if (!skill) return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    const threshold = autoEvolveTrustThreshold();
    if (skill.frontmatter.evolution.ownerApprovalsCount < threshold) {
      return NextResponse.json(
        {
          error:
            `Auto-evolve unlocks after you've approved ${threshold} updates to this skill. ` +
            `So far you've approved ${skill.frontmatter.evolution.ownerApprovalsCount}.`,
        },
        { status: 409 },
      );
    }
  }

  const result = await setAutoEvolve(ctx, params.slug, parsed.data.enabled);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
  return NextResponse.json({ ok: true, autoEvolve: parsed.data.enabled });
}
