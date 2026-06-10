// POST /api/channels/slack/persona — set the Persona that answers on the owner's Slack channel
// (PA-CHAN-8). Body: { personaId: string | null }. A non-null id is verified to belong to the
// caller before it's stored. null clears it back to the gateway's default Persona.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { fetchPersona } from "@/lib/personas/db";
import { setChannelConnectionPersona } from "@/lib/channels/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({ personaId: z.string().uuid().nullable() });

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const { personaId } = parsed.data;

  // Ownership: a non-null persona must belong to the caller.
  if (personaId) {
    const persona = await fetchPersona(personaId);
    if (!persona || persona.owner_user_id !== user.id) {
      return NextResponse.json({ error: "persona_not_found" }, { status: 404 });
    }
  }

  const res = await setChannelConnectionPersona(user.id, "slack", personaId);
  if (!res.ok) return NextResponse.json({ error: "update_failed" }, { status: res.status });
  return NextResponse.json({ ok: true });
}
