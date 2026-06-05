import { NextResponse } from "next/server";
import { requireOwnedPersona, resolveOwner } from "@/lib/personas/owner";
import {
  fetchConversation,
  listConversationsForPersona,
  listMessages,
  listSeats,
  PersonaDbError,
} from "@/lib/personas/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

// GET — owner reads the persona's conversation log. Without ?conversationId, returns
// the list of conversations (annotated with the seat's email). With ?conversationId,
// returns that conversation's messages (owner can read everything).
export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  const owner = await resolveOwner();
  if (!owner.ok) return NextResponse.json({ error: owner.error }, { status: owner.status });

  try {
    const owned = await requireOwnedPersona(params.id, owner.ctx.userId);
    if (!owned.ok) return NextResponse.json({ error: owned.error }, { status: owned.status });

    const conversationId = new URL(req.url).searchParams.get("conversationId");

    if (conversationId) {
      const convo = await fetchConversation(conversationId);
      if (!convo || convo.persona_id !== params.id) {
        return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
      }
      const messages = await listMessages(conversationId);
      return NextResponse.json({ conversation: convo, messages });
    }

    const [conversations, seats] = await Promise.all([
      listConversationsForPersona(params.id),
      listSeats(params.id),
    ]);
    const seatEmail = new Map(seats.map((s) => [s.id, s.invited_email]));
    return NextResponse.json({
      conversations: conversations.map((c) => ({
        ...c,
        seatEmail: c.seat_id ? seatEmail.get(c.seat_id) ?? null : null,
      })),
    });
  } catch (e) {
    const status = e instanceof PersonaDbError ? e.status : 500;
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unexpected error" },
      { status },
    );
  }
}
