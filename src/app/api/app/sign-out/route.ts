import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/app/login", req.url));
}
