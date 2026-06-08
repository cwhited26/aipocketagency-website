import { createClient } from "@/lib/supabase/server";
import { getProject } from "@/lib/pa-projects";
import { listProjectConversationThreads, createConversation } from "@/lib/pa-conversations";
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

  const result = await listProjectConversationThreads(user.id, params.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ conversations: result.data });
}

// Start a fresh conversation inside the project. The new thread is linked to the project, so the
// agent loop auto-applies the project's Instructions + references + memory the moment the owner
// sends their first message. The client redirects into /app/ask?c=<id> to chat.
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await getProject(params.id, user.id);
  if (!project.ok) return NextResponse.json({ error: project.error }, { status: project.status });
  if (!project.data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await createConversation(user.id, "New conversation", params.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ conversation: result.data }, { status: 201 });
}
