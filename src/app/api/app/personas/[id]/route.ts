// PATCH /api/app/personas/[id] — rename a Persona instance (PA-POS-35).
//
// One field: `display_name` — the customer-chosen name ("Marcus"). Setting it never touches
// the template-derived `personas.name`, so `null` clears the rename and every surface falls
// back to the template's name through getPersonaDisplayName(). Owner-scoped: a persona that
// isn't yours 403s before any write.

import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveOwner, requireOwnedPersona } from "@/lib/personas/owner";
import { updatePersona, PersonaDbError } from "@/lib/personas/db";
import { getPersonaDisplayName, personaDisplayNameSchema } from "@/lib/personas/types";
import { markOnboardingStepComplete } from "@/lib/onboarding/progress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

const patchSchema = z.object({
  display_name: personaDisplayNameSchema.nullable(),
});

export async function PATCH(req: Request, { params }: Params): Promise<NextResponse> {
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
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 422 });
  }

  try {
    const updated = await updatePersona(params.id, { display_name: parsed.data.display_name });
    if (!updated) return NextResponse.json({ error: "Persona not found" }, { status: 404 });
    // PA-POS-36: naming a Persona here completes "Name a Persona" — same hook as the legacy
    // PATCH's `name` field, since this is where the PA-POS-35 rename surfaces land. Never throws.
    if (parsed.data.display_name !== null) {
      await markOnboardingStepComplete(owner.ctx.userId, "name_persona");
    }
    return NextResponse.json({ persona: updated, displayName: getPersonaDisplayName(updated) });
  } catch (e) {
    const status = e instanceof PersonaDbError ? e.status : 500;
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Update failed" },
      { status },
    );
  }
}
