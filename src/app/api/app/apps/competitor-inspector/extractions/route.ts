// GET /api/app/apps/competitor-inspector/extractions — the owner's capture runs, newest first.
// Slim columns only (never the profile body or screenshot base64); the client polls this while
// a capture is in flight.

import { createClient } from "@/lib/supabase/server";
import { listExtractions } from "@/lib/url-extraction/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await listExtractions(user.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ extractions: result.data });
}
