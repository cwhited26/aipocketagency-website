// POST /api/app/skills/proposals/[id]/approve
//
// Approve a LEARN-phase Skill proposal (PA-SKILL-3). This is the commit-on-approve write: it saves
// a versioned SKILL.md to the owner's brain. An 'update' sharpens the named Skill into a new
// version (and counts an owner approval toward the auto-evolve trust window); a 'new' creates the
// Skill at v1. The owner may pass edited body/description/when_to_use to honor the Edit affordance
// — what they approve is exactly what gets written.

import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveOwnerSkillCtx } from "@/lib/skills/route-helpers";
import { fetchInboxItemById, resolveInboxItem } from "@/lib/pa-inbox-items";
import { createSkill, evolveSkill, readSkill, type SkillRepo } from "@/lib/skills/store";
import { skillSlugify } from "@/lib/skills/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const overrideSchema = z.object({
  name: z.string().max(120).optional(),
  description: z.string().max(400).optional(),
  whenToUse: z.string().max(600).optional(),
  body: z.string().max(8_000).optional(),
});

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const owner = await resolveOwnerSkillCtx();
  if (!owner.ok) return NextResponse.json({ error: owner.error }, { status: owner.status });
  if (!owner.token) {
    return NextResponse.json({ error: "Connect your brain (GitHub) to save Skills." }, { status: 409 });
  }

  // Optional edited fields (the Edit affordance). Absent → the proposed payload is the source.
  let override: z.infer<typeof overrideSchema> = {};
  const rawBody = await req.json().catch(() => null);
  if (rawBody !== null) {
    const parsed = overrideSchema.safeParse(rawBody);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 422 });
    override = parsed.data;
  }

  const found = await fetchInboxItemById(params.id);
  if (!found.ok) return NextResponse.json({ error: found.error }, { status: found.status });
  const item = found.data;
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (item.user_id !== owner.userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (item.kind !== "skill_evolution_proposal") {
    return NextResponse.json({ error: "Not a skill proposal" }, { status: 400 });
  }
  if (item.status === "approved") {
    return NextResponse.json({ status: "approved", alreadyResolved: true });
  }
  if (item.status !== "pending") {
    return NextResponse.json({ error: `Cannot approve an item that is '${item.status}'.` }, { status: 409 });
  }

  const payload = item.payload;
  const proposedBody = override.body ?? str(payload.proposedBody);
  if (!proposedBody.trim()) {
    return NextResponse.json({ error: "Nothing to save — the proposed technique is empty." }, { status: 422 });
  }
  const description = override.description ?? str(payload.proposedDescription);
  const whenToUse = override.whenToUse ?? str(payload.proposedWhenToUse);
  const prerequisites = strArray(payload.proposedPrerequisites);
  const zone = str(payload.proposedZone) || "project-shared";
  const runId = str(payload.runId);
  const action = payload.action === "update" ? "update" : "new";
  const slug = str(payload.slug) || skillSlugify(str(payload.name) || item.title);
  const displayName = override.name ?? (str(payload.name) || item.title);

  const ctx: SkillRepo = { repo: owner.repo, token: owner.token };
  const current = await readSkill(ctx, slug);

  const written =
    action === "update" || current
      ? current
        ? await evolveSkill(
            ctx,
            { body: proposedBody, description, whenToUse, prerequisites },
            current,
            new Date().toISOString(),
            { fromRunId: runId || undefined, bumpApprovals: true },
          )
        : { ok: false as const, error: "The skill this update targets no longer exists." }
      : await createSkill(
          ctx,
          { name: displayName, slug, description, whenToUse, body: proposedBody, zone, prerequisites, ownerApprovals: 1 },
          new Date().toISOString(),
        );

  if (!written.ok) return NextResponse.json({ error: written.error }, { status: 502 });

  const resolved = await resolveInboxItem(params.id, "approved", owner.userId);
  if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status });

  return NextResponse.json({ status: "approved", slug, version: written.version });
}
