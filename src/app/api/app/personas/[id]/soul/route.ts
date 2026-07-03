// GET  /api/app/personas/[id]/soul   — the owner-facing Soul read (Soul System SPEC §Owner controls).
// POST /api/app/personas/[id]/soul   — the owner adds a Soul attribute by hand.
//
// GET returns this persona's LIVE Soul attributes (what it currently believes about how the owner
// likes to be worked with), grouped client-side by kind, plus the tier context (extraction mode, cap,
// live count). Owner-scoped: a persona that isn't yours 403s before any row is read.
//
// POST is the manual-add path — allowed on every tier (even read-only Personal), capped by the tier.

import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveOwner, requireOwnedPersona } from "@/lib/personas/owner";
import {
  getCurrentTier,
  soulActiveCap,
  soulExtractionMode,
  tierAllowsSoulExtraction,
} from "@/lib/personas/tier-caps";
import { listLiveForPersona } from "@/lib/personas/soul-db";
import { addSoulAttributeManually } from "@/lib/personas/soul-extract";
import { SOUL_ATTRIBUTE_KINDS, type SoulAttributeRow } from "@/lib/personas/soul-types";
import { getPersonaDisplayName } from "@/lib/personas/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

type SoulView = {
  id: string;
  kind: SoulAttributeRow["attribute_kind"];
  summary: string;
  body: string | null;
  confidence: number;
  locked: boolean;
  createdAt: string;
  updatedAt: string;
};

function toView(r: SoulAttributeRow): SoulView {
  return {
    id: r.id,
    kind: r.attribute_kind,
    summary: r.attribute_summary,
    body: r.attribute_body,
    confidence: r.confidence,
    locked: r.locked,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function GET(_req: Request, { params }: Params): Promise<NextResponse> {
  const owner = await resolveOwner();
  if (!owner.ok) return NextResponse.json({ error: owner.error }, { status: owner.status });

  const owned = await requireOwnedPersona(params.id, owner.ctx.userId);
  if (!owned.ok) return NextResponse.json({ error: owned.error }, { status: owned.status });

  const list = await listLiveForPersona(params.id);
  if (!list.ok) return NextResponse.json({ error: list.error }, { status: list.status });

  const tier = await getCurrentTier(owner.ctx.userId);
  const cap = soulActiveCap(tier);

  return NextResponse.json({
    personaName: getPersonaDisplayName(owned.persona),
    attributes: list.data.map(toView),
    tier,
    extractionMode: soulExtractionMode(tier),
    canSuggest: tierAllowsSoulExtraction(tier),
    cap,
    liveCount: list.data.length,
    provisioned: list.degraded !== "table_missing",
  });
}

const AddSchema = z.object({
  kind: z.enum(SOUL_ATTRIBUTE_KINDS),
  summary: z.string().trim().min(1).max(240),
  body: z.string().trim().max(4_000).optional(),
});

export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const owner = await resolveOwner();
  if (!owner.ok) return NextResponse.json({ error: owner.error }, { status: owner.status });

  const owned = await requireOwnedPersona(params.id, owner.ctx.userId);
  if (!owned.ok) return NextResponse.json({ error: owned.error }, { status: owned.status });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = AddSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 422 });
  }

  const tier = await getCurrentTier(owner.ctx.userId);
  const written = await addSoulAttributeManually({
    personaId: params.id,
    ownerId: owner.ctx.userId,
    tier,
    kind: parsed.data.kind,
    summary: parsed.data.summary,
    body: parsed.data.body ?? null,
  });
  if (!written.ok) return NextResponse.json({ error: written.error }, { status: written.status });

  return NextResponse.json({ status: "added", soulId: written.data.id });
}
