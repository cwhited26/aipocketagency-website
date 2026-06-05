import { NextResponse } from "next/server";
import { requireOwnedPersona, resolveOwner } from "@/lib/personas/owner";
import {
  fetchSeat,
  PersonaDbError,
  revokeTokensForSeat,
  updateSeat,
} from "@/lib/personas/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { id: string; seatId: string } };

// DELETE — revoke a seat: stamp revoked_at and revoke all its share tokens. Token
// validation in the chat endpoint is a per-request DB check, so this takes effect on
// the seat's very next message (SPEC Success Criterion #7).
export async function DELETE(_req: Request, { params }: Params): Promise<NextResponse> {
  const owner = await resolveOwner();
  if (!owner.ok) return NextResponse.json({ error: owner.error }, { status: owner.status });

  try {
    const owned = await requireOwnedPersona(params.id, owner.ctx.userId);
    if (!owned.ok) return NextResponse.json({ error: owned.error }, { status: owned.status });

    const seat = await fetchSeat(params.seatId);
    if (!seat || seat.persona_id !== params.id) {
      return NextResponse.json({ error: "Seat not found" }, { status: 404 });
    }

    await revokeTokensForSeat(seat.id);
    await updateSeat(seat.id, { revoked_at: new Date().toISOString() });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const status = e instanceof PersonaDbError ? e.status : 500;
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unexpected error" },
      { status },
    );
  }
}
