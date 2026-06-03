import { createClient } from "@/lib/supabase/server";
import { countPendingInbox } from "@/lib/pa-inbox-items";
import { listActionsForUser } from "@/lib/pa-actions";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Live count of everything awaiting the user in the Inbox: new staged items +
// pending legacy brain-memory proposals (both render in the same queue).
export async function GET(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ total: 0 });

  const [inboxPending, legacy] = await Promise.all([
    countPendingInbox(user.id),
    listActionsForUser(user.id),
  ]);

  const legacyPending = legacy.ok
    ? legacy.data.filter((a) => a.status === "pending").length
    : 0;

  return NextResponse.json({ total: inboxPending + legacyPending });
}
