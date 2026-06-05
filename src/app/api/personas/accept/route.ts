import { NextResponse } from "next/server";
import { z } from "zod";
import {
  fetchPersona,
  fetchSeat,
  fetchShareToken,
  PersonaDbError,
  updateSeat,
} from "@/lib/personas/db";
import { isTokenLive } from "@/lib/personas/tokens";
import { chatUrlForToken } from "@/lib/personas/links";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public endpoint (team members have no PA session). Validates the invite token via the
// service-role key, stamps the seat as accepted, and returns the chat URL. Access is
// scoped entirely to the token — the team member never sees the owner's dashboard.
const bodySchema = z.object({ token: z.string().min(10).max(200) });

export async function POST(req: Request): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid token" }, { status: 422 });

  try {
    const tokenRow = await fetchShareToken(parsed.data.token);
    if (!tokenRow || !isTokenLive(tokenRow)) {
      return NextResponse.json({ error: "This invite link is no longer valid." }, { status: 410 });
    }

    const persona = await fetchPersona(tokenRow.persona_id);
    if (!persona || persona.status === "archived") {
      return NextResponse.json({ error: "This persona is no longer available." }, { status: 404 });
    }

    if (tokenRow.seat_id) {
      const seat = await fetchSeat(tokenRow.seat_id);
      if (seat && !seat.accepted_at && !seat.revoked_at) {
        await updateSeat(seat.id, { accepted_at: new Date().toISOString() });
      }
      if (seat?.revoked_at) {
        return NextResponse.json({ error: "Your access has been revoked." }, { status: 410 });
      }
    }

    return NextResponse.json({
      personaName: persona.name,
      chatUrl: chatUrlForToken(tokenRow.token),
    });
  } catch (e) {
    const status = e instanceof PersonaDbError ? e.status : 500;
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unexpected error" },
      { status },
    );
  }
}
