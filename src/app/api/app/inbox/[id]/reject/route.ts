import { createClient } from "@/lib/supabase/server";
import { fetchInboxItemById, resolveInboxItem } from "@/lib/pa-inbox-items";
import { extractSoulFromInboxResolution } from "@/lib/personas/soul-extract";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Reject a draft (it won't execute) or answer a decision "no". Either way the
// row is marked rejected and the decision persists on the row.
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = params;

  const found = await fetchInboxItemById(id);
  if (!found.ok) return NextResponse.json({ error: found.error }, { status: found.status });
  const item = found.data;
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (item.user_id !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Idempotent — already decided, return as-is.
  if (item.status !== "pending") {
    return NextResponse.json({ status: item.status });
  }

  const resolved = await resolveInboxItem(id, "rejected", user.id);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  // Continuous Soul extraction (Soul System SPEC): a rejection is a verdict too — the owner pushing
  // back can reveal a boundary or a preference. Best-effort; persona-tied cards only (the helper
  // returns early otherwise). Never affects the rejection that already succeeded.
  try {
    await extractSoulFromInboxResolution({ item, outcome: "rejected" });
  } catch {
    // swallowed by design.
  }

  return NextResponse.json({ status: "rejected" });
}
