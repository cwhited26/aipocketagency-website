import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { generateCalendarScan } from "@/lib/pa-drafts";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  void req;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const paResult = await fetchPaUser(user.id);
  if (!paResult.ok) {
    return NextResponse.json({ error: "User record not found" }, { status: 404 });
  }

  const paUser = paResult.data;
  if (!paUser?.anthropic_api_key) {
    return NextResponse.json(
      {
        error: "no_api_key",
        message: "Add your Anthropic API key in Settings to scan your calendar.",
      },
      { status: 402 },
    );
  }

  try {
    const result = await generateCalendarScan(
      paUser.anthropic_api_key,
      paUser.brain_repo,
      paUser.github_token,
    );
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
