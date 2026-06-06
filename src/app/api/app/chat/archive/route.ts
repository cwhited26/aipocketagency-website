import { createClient } from "@/lib/supabase/server";
import { chatAsHomeEnabled } from "@/lib/chat/feature-flag";
import { archiveMessage, ChatDbError } from "@/lib/chat/db";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({ id: z.string().uuid() });

// POST /api/app/chat/archive { id } → { ok }
// Soft-archives a message (append-only history — never a hard delete). Scoped to the owner.
export async function POST(req: Request): Promise<NextResponse> {
  if (!chatAsHomeEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let id: string;
  try {
    const raw = (await req.json().catch(() => ({}))) as unknown;
    id = BodySchema.parse(raw).id;
  } catch {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    await archiveMessage(user.id, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const status = e instanceof ChatDbError ? e.status : 500;
    return NextResponse.json({ error: "Could not archive" }, { status });
  }
}
