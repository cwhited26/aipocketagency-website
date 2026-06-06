import { createClient } from "@/lib/supabase/server";
import { chatAsHomeEnabled } from "@/lib/chat/feature-flag";
import { listMessages, listAllForSearch, ChatDbError } from "@/lib/chat/db";
import { FilterTagSchema } from "@/lib/chat/types";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/app/chat/messages?filter=&before=&limit=&all=1
// Returns the owner's chat history (newest-first). With all=1, returns a bounded slice of
// the whole history for client-side search/export.
export async function GET(req: Request): Promise<NextResponse> {
  if (!chatAsHomeEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);

  try {
    if (url.searchParams.get("all") === "1") {
      const messages = await listAllForSearch(user.id);
      return NextResponse.json({ messages });
    }

    const rawFilter = url.searchParams.get("filter");
    const filter = rawFilter ? FilterTagSchema.parse(rawFilter) : undefined;
    const before = url.searchParams.get("before") ?? undefined;
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? Number(limitParam) : undefined;

    const messages = await listMessages({
      userId: user.id,
      filter: filter === "general" ? undefined : filter,
      before,
      limit: Number.isFinite(limit) ? limit : undefined,
    });
    return NextResponse.json({ messages });
  } catch (e) {
    const status = e instanceof ChatDbError ? e.status : 400;
    return NextResponse.json({ error: "Could not load messages" }, { status });
  }
}
