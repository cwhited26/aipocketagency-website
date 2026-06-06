import { createClient } from "@/lib/supabase/server";
import { chatAsHomeEnabled } from "@/lib/chat/feature-flag";
import { getFilterState, setFilterState, ChatDbError } from "@/lib/chat/db";
import { SetFilterSchema } from "@/lib/chat/types";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function gate(): NextResponse | null {
  return chatAsHomeEnabled() ? null : NextResponse.json({ error: "Not found" }, { status: 404 });
}

// GET /api/app/chat/filter → { filter }
export async function GET(): Promise<NextResponse> {
  const blocked = gate();
  if (blocked) return blocked;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    return NextResponse.json({ filter: await getFilterState(user.id) });
  } catch (e) {
    const status = e instanceof ChatDbError ? e.status : 500;
    return NextResponse.json({ error: "Could not read filter" }, { status });
  }
}

// POST /api/app/chat/filter { filter } → { filter }
export async function POST(req: Request): Promise<NextResponse> {
  const blocked = gate();
  if (blocked) return blocked;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let filter: z.infer<typeof SetFilterSchema>["filter"];
  try {
    const raw = (await req.json().catch(() => ({}))) as unknown;
    filter = SetFilterSchema.parse(raw).filter;
  } catch {
    return NextResponse.json({ error: "Invalid filter" }, { status: 400 });
  }

  try {
    await setFilterState(user.id, filter);
    return NextResponse.json({ filter });
  } catch (e) {
    const status = e instanceof ChatDbError ? e.status : 500;
    return NextResponse.json({ error: "Could not save filter" }, { status });
  }
}
