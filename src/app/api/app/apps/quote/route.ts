import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { generateQuoteDraft } from "@/lib/pa-drafts";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  clientName: z.string().min(1).max(200),
  scopeDescription: z.string().min(1).max(5000),
  specifics: z.string().max(3000).optional().default(""),
});

export async function POST(req: Request): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 422 });
  }

  const { clientName, scopeDescription, specifics } = parsed.data;

  const paResult = await fetchPaUser(user.id);
  if (!paResult.ok) {
    return NextResponse.json({ error: "User record not found" }, { status: 404 });
  }

  const paUser = paResult.data;
  if (!paUser?.anthropic_api_key) {
    return NextResponse.json(
      {
        error: "no_api_key",
        message: "Add your Anthropic API key in Settings to generate quotes.",
      },
      { status: 402 },
    );
  }

  try {
    const result = await generateQuoteDraft(
      { clientName, scopeDescription, specifics },
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
