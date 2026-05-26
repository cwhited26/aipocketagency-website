import { createClient } from "@/lib/supabase/server";
import { listActionsForUser } from "@/lib/pa-actions";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ total: 0 });

  const result = await listActionsForUser(user.id);
  const pending = result.ok
    ? result.data.filter((a) => a.status === "pending").length
    : 0;

  return NextResponse.json({ total: pending });
}
