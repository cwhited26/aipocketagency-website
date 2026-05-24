import { createClient } from "@/lib/supabase/server";
import { fetchActionById, updateActionStatus } from "@/lib/pa-actions";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const actionResult = await fetchActionById(id);
  if (!actionResult.ok) {
    return NextResponse.json({ error: actionResult.error }, { status: actionResult.status });
  }
  const action = actionResult.data;
  if (!action) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Ownership gate
  if (action.user_id !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Idempotency — already decided, return as-is
  if (action.status !== "pending") {
    return NextResponse.json({ action });
  }

  const updateResult = await updateActionStatus(id, {
    status: "rejected",
    decided_at: new Date().toISOString(),
  });

  if (!updateResult.ok) {
    return NextResponse.json({ error: updateResult.error }, { status: updateResult.status });
  }

  return NextResponse.json({ action: updateResult.data });
}
