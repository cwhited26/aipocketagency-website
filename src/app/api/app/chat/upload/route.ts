import { createClient } from "@/lib/supabase/server";
import { chatAsHomeEnabled } from "@/lib/chat/feature-flag";
import { insertMessage, ChatDbError } from "@/lib/chat/db";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Wave A surfaces a dropped file as a doc_preview card in the chat. The client extracts the
// metadata (+ a text excerpt for text files); persisting the actual bytes to the brain
// remains the job of the standalone /app/capture flow (linked from the card).
const BodySchema = z.object({
  fileName: z.string().min(1).max(500),
  mimeType: z.string().max(200).optional(),
  sizeBytes: z.number().int().nonnegative().max(5_000_000_000).optional(),
  excerpt: z.string().max(2_000).optional(),
});

// POST /api/app/chat/upload → { card }
export async function POST(req: Request): Promise<NextResponse> {
  if (!chatAsHomeEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: z.infer<typeof BodySchema>;
  try {
    const raw = (await req.json().catch(() => ({}))) as unknown;
    body = BodySchema.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid file metadata" }, { status: 400 });
  }

  try {
    const card = await insertMessage({
      userId: user.id,
      role: "inline_card",
      cardKind: "doc_preview",
      cardPayload: {
        fileName: body.fileName,
        mimeType: body.mimeType,
        sizeBytes: body.sizeBytes,
        excerpt: body.excerpt,
        openHref: "/app/capture",
      },
      filterTags: ["docs"],
    });
    return NextResponse.json({ card });
  } catch (e) {
    const status = e instanceof ChatDbError ? e.status : 500;
    return NextResponse.json({ error: "Could not add the file" }, { status });
  }
}
