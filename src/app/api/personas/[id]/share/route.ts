import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwnedPersona, resolveOwner } from "@/lib/personas/owner";
import {
  insertShareToken,
  PersonaDbError,
  revokeAllPersonaTokens,
} from "@/lib/personas/db";
import { generateShareToken } from "@/lib/personas/tokens";
import { chatUrlForToken } from "@/lib/personas/links";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

const bodySchema = z.object({ regenerate: z.boolean().default(false) }).default({ regenerate: false });

// POST — mint a quick (seat-less) share link for the persona. With regenerate:true,
// every existing token for the persona is revoked first (Settings → regenerate share
// link invalidates old links).
export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const owner = await resolveOwner();
  if (!owner.ok) return NextResponse.json({ error: owner.error }, { status: owner.status });

  const raw = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 422 });

  try {
    const owned = await requireOwnedPersona(params.id, owner.ctx.userId);
    if (!owned.ok) return NextResponse.json({ error: owned.error }, { status: owned.status });

    if (parsed.data.regenerate) {
      await revokeAllPersonaTokens(params.id);
    }

    const token = generateShareToken();
    const row = await insertShareToken({
      token,
      persona_id: params.id,
      seat_id: null,
      expires_at: null,
    });

    return NextResponse.json({ token: row.token, chatUrl: chatUrlForToken(row.token) }, { status: 201 });
  } catch (e) {
    const status = e instanceof PersonaDbError ? e.status : 500;
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unexpected error" },
      { status },
    );
  }
}
