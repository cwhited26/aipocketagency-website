import { createClient } from "@/lib/supabase/server";
import { getConversation, getMessages } from "@/lib/pa-conversations";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = params;

  const convResult = await getConversation(id, user.id);
  if (!convResult.ok) {
    return NextResponse.json({ error: convResult.error }, { status: convResult.status });
  }
  if (!convResult.data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const msgResult = await getMessages(id, user.id);
  if (!msgResult.ok) {
    return NextResponse.json({ error: msgResult.error }, { status: msgResult.status });
  }

  return NextResponse.json({
    conversation: convResult.data,
    messages: msgResult.data,
  });
}
