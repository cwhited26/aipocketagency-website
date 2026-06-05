import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwnedPersona, resolveOwner } from "@/lib/personas/owner";
import {
  fetchCurrentSpec,
  fetchUsageMonthly,
  listSeats,
  PersonaDbError,
  updatePersona,
} from "@/lib/personas/db";
import { getCurrentTier, monthKey, TIER_LIMITS } from "@/lib/personas/tier-caps";
import { parsePersonaSpecMarkdown } from "@/lib/personas/spec";
import { personaNameSchema, toneSchema, PERSONA_STATUSES } from "@/lib/personas/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params): Promise<NextResponse> {
  const owner = await resolveOwner();
  if (!owner.ok) return NextResponse.json({ error: owner.error }, { status: owner.status });

  try {
    const owned = await requireOwnedPersona(params.id, owner.ctx.userId);
    if (!owned.ok) return NextResponse.json({ error: owned.error }, { status: owned.status });
    const { persona } = owned;

    const [spec, seats, usage, tier] = await Promise.all([
      fetchCurrentSpec(persona),
      listSeats(persona.id),
      fetchUsageMonthly(persona.id, monthKey()),
      getCurrentTier(persona.business_id),
    ]);

    const limits = TIER_LIMITS[tier];
    const messageCap = limits.messagesPerMonthPerPersona;
    const messagesThisMonth = usage?.message_count ?? 0;

    return NextResponse.json({
      persona,
      spec: spec
        ? { id: spec.id, version: spec.version, fields: parsePersonaSpecMarkdown(spec.body_md), createdAt: spec.created_at }
        : null,
      seats,
      usage: {
        messagesThisMonth,
        messageCap,
        capReached: messageCap !== null && messagesThisMonth >= messageCap,
      },
      tier,
    });
  } catch (e) {
    const status = e instanceof PersonaDbError ? e.status : 500;
    return NextResponse.json({ error: errMsg(e) }, { status });
  }
}

const patchSchema = z
  .object({
    name: personaNameSchema.optional(),
    tone: toneSchema.optional(),
    status: z.enum(PERSONA_STATUSES).optional(),
  })
  .refine((v) => v.name !== undefined || v.tone !== undefined || v.status !== undefined, {
    message: "Nothing to update",
  });

export async function PATCH(req: Request, { params }: Params): Promise<NextResponse> {
  const owner = await resolveOwner();
  if (!owner.ok) return NextResponse.json({ error: owner.error }, { status: owner.status });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 422 });
  }

  try {
    const owned = await requireOwnedPersona(params.id, owner.ctx.userId);
    if (!owned.ok) return NextResponse.json({ error: owned.error }, { status: owned.status });

    const updated = await updatePersona(params.id, parsed.data);
    return NextResponse.json({ persona: updated });
  } catch (e) {
    const status = e instanceof PersonaDbError ? e.status : 500;
    return NextResponse.json({ error: errMsg(e) }, { status });
  }
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Unexpected error";
}
