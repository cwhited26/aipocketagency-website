import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { generateEmailDraft } from "@/lib/pa-drafts";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Quick mode: a single one-line ask the model expands itself.
// Detailed mode: the operator drives the structured fields.
const quickSchema = z.object({
  mode: z.literal("quick"),
  brief: z.string().min(1).max(2000),
});
const detailedSchema = z.object({
  mode: z.literal("detailed").optional(),
  recipient: z.string().min(1).max(200),
  relationship: z.string().max(500).optional().default(""),
  purpose: z.string().min(1).max(2000),
  keyPoints: z.string().max(3000).optional().default(""),
  tone: z.string().max(200).optional().default(""),
});
const bodySchema = z.union([quickSchema, detailedSchema]);

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

  const draftInput =
    "brief" in parsed.data
      ? { recipient: "", relationship: "", purpose: "", keyPoints: "", tone: "", brief: parsed.data.brief }
      : {
          recipient: parsed.data.recipient,
          relationship: parsed.data.relationship,
          purpose: parsed.data.purpose,
          keyPoints: parsed.data.keyPoints,
          tone: parsed.data.tone,
        };

  const paResult = await fetchPaUser(user.id);
  if (!paResult.ok) {
    return NextResponse.json({ error: "User record not found" }, { status: 404 });
  }

  const paUser = paResult.data;
  if (!paUser?.anthropic_api_key) {
    return NextResponse.json(
      {
        error: "no_api_key",
        message: "Add your Anthropic API key in Settings to draft emails.",
      },
      { status: 402 },
    );
  }

  try {
    const result = await generateEmailDraft(
      draftInput,
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
