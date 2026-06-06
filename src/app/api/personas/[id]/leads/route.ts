// leads — owner-only queue of captured leads for a persona (SPEC v3 §7). GET lists leads
// newest-first; PATCH updates a lead's status (new → contacted / qualified / junk). Not
// flag-gated: this is an authenticated owner surface, not anonymous traffic.

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwnedPersona, resolveOwner } from "@/lib/personas/owner";
import { fetchLead, listLeads, PersonaDbError, updateLeadStatus } from "@/lib/personas/db";
import { LEAD_STATUSES } from "@/lib/personas/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params): Promise<NextResponse> {
  const owner = await resolveOwner();
  if (!owner.ok) return NextResponse.json({ error: owner.error }, { status: owner.status });
  try {
    const owned = await requireOwnedPersona(params.id, owner.ctx.userId);
    if (!owned.ok) return NextResponse.json({ error: owned.error }, { status: owned.status });
    const leads = await listLeads(params.id);
    return NextResponse.json({ leads });
  } catch (e) {
    return fail(e);
  }
}

const patchSchema = z.object({
  leadId: z.string().uuid(),
  status: z.enum(LEAD_STATUSES),
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
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 422 });

  try {
    const owned = await requireOwnedPersona(params.id, owner.ctx.userId);
    if (!owned.ok) return NextResponse.json({ error: owned.error }, { status: owned.status });

    // Bind the lead to THIS persona before mutating — no cross-persona status writes.
    const lead = await fetchLead(parsed.data.leadId);
    if (!lead || lead.persona_id !== params.id) {
      return NextResponse.json({ error: "Lead not found." }, { status: 404 });
    }
    const updated = await updateLeadStatus(parsed.data.leadId, parsed.data.status);
    return NextResponse.json({ lead: updated });
  } catch (e) {
    return fail(e);
  }
}

function fail(e: unknown): NextResponse {
  const status = e instanceof PersonaDbError ? e.status : 500;
  return NextResponse.json(
    { error: e instanceof Error ? e.message : "Unexpected error" },
    { status },
  );
}
