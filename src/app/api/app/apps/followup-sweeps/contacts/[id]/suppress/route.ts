// /api/app/apps/followup-sweeps/contacts/[id]/suppress — mark a contact "leave alone" (or undo it).
// Suppression persists (PA-FUS-5): a suppressed contact is upserted-through on every re-sweep and
// never drafted again until the owner clears the flag. Owner-scoped via the session.

import { createClient } from "@/lib/supabase/server";
import { setContactSuppressed } from "@/lib/followup-sweeps/db";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ suppressed: z.boolean().optional().default(true) });

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Body is optional; default to suppressing.
  let suppressed = true;
  const raw = await req.json().catch(() => null);
  if (raw !== null) {
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 422 });
    suppressed = parsed.data.suppressed;
  }

  const result = await setContactSuppressed(params.id, user.id, suppressed);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ contact: result.data });
}
