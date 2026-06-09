// GET  /api/app/skills  — the owner's accumulated Skills (summaries) + any pending evolution
//                         proposals from the LEARN phase (PA-SKILL-2 surface data).
// POST /api/app/skills  — hand-create a Skill (the "+ Create a Skill manually" affordance, §9.1),
//                         so an owner can seed a technique without waiting for LEARN to discover it.

import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveOwnerSkillCtx } from "@/lib/skills/route-helpers";
import { createSkill, listSkillSummaries } from "@/lib/skills/store";
import { listInboxItems } from "@/lib/pa-inbox-items";
import { DEFAULT_RUN_ZONE } from "@/lib/orchestrator/dispatcher";
import { skillSlugify, type SkillSummary } from "@/lib/skills/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type SkillProposalSummary = {
  inboxItemId: string;
  action: "new" | "update";
  slug: string;
  name: string;
  reason: string;
  createdAt: string;
};

export async function GET(): Promise<NextResponse> {
  const owner = await resolveOwnerSkillCtx();
  if (!owner.ok) return NextResponse.json({ error: owner.error }, { status: owner.status });

  const skills: SkillSummary[] = await listSkillSummaries({ repo: owner.repo, token: owner.token });

  // Pending proposals are pa_inbox_items; surface them on the Skills tab too (not just Mission
  // Control). Best-effort — a degraded inbox read still renders the Skills list.
  const proposals: SkillProposalSummary[] = [];
  const inbox = await listInboxItems(owner.userId);
  if (inbox.ok) {
    for (const item of inbox.data) {
      if (item.kind !== "skill_evolution_proposal" || item.status !== "pending") continue;
      const p = item.payload as { action?: unknown; slug?: unknown; name?: unknown; reason?: unknown };
      proposals.push({
        inboxItemId: item.id,
        action: p.action === "update" ? "update" : "new",
        slug: typeof p.slug === "string" ? p.slug : "",
        name: typeof p.name === "string" ? p.name : item.title,
        reason: typeof p.reason === "string" ? p.reason : "",
        createdAt: item.created_at,
      });
    }
  }

  return NextResponse.json({ skills, proposals });
}

const createSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(400).optional().default(""),
  whenToUse: z.string().max(600).optional().default(""),
  body: z.string().min(1).max(8_000),
  zone: z.string().min(1).max(120).optional(),
  prerequisites: z.array(z.string().max(300)).max(20).optional().default([]),
});

export async function POST(req: Request): Promise<NextResponse> {
  const owner = await resolveOwnerSkillCtx();
  if (!owner.ok) return NextResponse.json({ error: owner.error }, { status: owner.status });
  if (!owner.token) {
    return NextResponse.json({ error: "Connect your brain (GitHub) to save Skills." }, { status: 409 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 422 });

  const slug = skillSlugify(parsed.data.name);
  const existing = await listSkillSummaries({ repo: owner.repo, token: owner.token });
  if (existing.some((s) => s.slug === slug)) {
    return NextResponse.json(
      { error: `A skill named "${parsed.data.name}" already exists. Open it to edit, or pick a different name.` },
      { status: 409 },
    );
  }

  const result = await createSkill(
    { repo: owner.repo, token: owner.token },
    {
      name: parsed.data.name,
      slug,
      description: parsed.data.description,
      whenToUse: parsed.data.whenToUse,
      body: parsed.data.body,
      zone: parsed.data.zone || DEFAULT_RUN_ZONE,
      prerequisites: parsed.data.prerequisites,
    },
    new Date().toISOString(),
  );
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
  return NextResponse.json({ slug, version: result.version }, { status: 201 });
}
