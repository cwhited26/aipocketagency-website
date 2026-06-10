// POST /api/app/personas/[id]/memory/forget-all
//
// The owner "forget" button (PA-MEM-5). With { contact } it forgets everything about one named contact
// ("Forget everything about [Contact]"); without it, it's the nuclear button — forget everything this
// persona believes about the owner. Both hard-DELETE. Requires { confirm: true } so a stray request
// can't wipe memory; the UI gates this behind an explicit confirm.

import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveOwner, requireOwnedPersona } from "@/lib/personas/owner";
import { deleteAllForPersona, deleteByContact } from "@/lib/persona-memory/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

const bodySchema = z.object({
  confirm: z.literal(true),
  contact: z.string().trim().min(1).max(120).optional(),
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
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Confirm the forget before it runs." },
      { status: 422 },
    );
  }

  if (parsed.data.contact) {
    const res = await deleteByContact(params.id, parsed.data.contact);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
    return NextResponse.json({ status: "forgotten", scope: "contact", contact: parsed.data.contact });
  }

  const res = await deleteAllForPersona(params.id);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ status: "forgotten", scope: "all" });
}
