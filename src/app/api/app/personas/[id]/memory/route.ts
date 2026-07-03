// GET /api/app/personas/[id]/memory
//
// The owner-facing memory inspector read (PA-MEM-5). Returns this persona's LIVE memories — what it
// currently believes about the owner — for the five-partition accordion surface, plus the distinct
// contacts (for the "Forget everything about [Contact]" filter) and the owner's tier cap context.
// Owner-scoped: a persona that isn't yours 403s before any row is read.

import { NextResponse } from "next/server";
import { resolveOwner, requireOwnedPersona } from "@/lib/personas/owner";
import { getPersonaDisplayName } from "@/lib/personas/types";
import { getCurrentTier, personaMemoryCap } from "@/lib/personas/tier-caps";
import { countLiveForOwner, listLiveForPersona } from "@/lib/persona-memory/db";
import type { PersonaMemoryRow } from "@/lib/persona-memory/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

type MemoryView = {
  id: string;
  partition: PersonaMemoryRow["partition"];
  tier: PersonaMemoryRow["tier"];
  body: string;
  importance: number;
  contactRef: string | null;
  untrustedOrigin: boolean;
  conversationId: string | null;
  createdAt: string;
};

function toView(r: PersonaMemoryRow): MemoryView {
  return {
    id: r.id,
    partition: r.partition,
    tier: r.tier,
    body: r.body,
    importance: r.importance,
    contactRef: r.contact_ref,
    untrustedOrigin: r.untrusted_origin,
    conversationId: r.conversation_id,
    createdAt: r.created_at,
  };
}

export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  const owner = await resolveOwner();
  if (!owner.ok) return NextResponse.json({ error: owner.error }, { status: owner.status });

  const owned = await requireOwnedPersona(params.id, owner.ctx.userId);
  if (!owned.ok) return NextResponse.json({ error: owned.error }, { status: owned.status });

  const list = await listLiveForPersona(params.id);
  if (!list.ok) return NextResponse.json({ error: list.error }, { status: list.status });

  // Optional contact filter (the marketing-claim lookup).
  const url = new URL(req.url);
  const contact = url.searchParams.get("contact");
  const rows = contact
    ? list.data.filter((r) => r.contact_ref === contact)
    : list.data;

  const contacts = Array.from(
    new Set(list.data.map((r) => r.contact_ref).filter((c): c is string => Boolean(c))),
  ).sort((a, b) => a.localeCompare(b));

  const tier = await getCurrentTier(owner.ctx.userId);
  const ownerCount = await countLiveForOwner(owner.ctx.userId);

  return NextResponse.json({
    personaName: getPersonaDisplayName(owned.persona),
    memories: rows.map(toView),
    contacts,
    tier,
    cap: personaMemoryCap(tier),
    liveCountAcrossPersonas: ownerCount.ok ? ownerCount.data : null,
    provisioned: list.degraded !== "table_missing",
  });
}
