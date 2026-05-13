import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin = new URL(request.url).origin;
  const supabase = createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo: `${origin}/app/auth/callback`,
      scopes: "repo read:user",
    },
  });

  if (error || !data.url) {
    return NextResponse.redirect(new URL("/app/login?error=oauth_init_failed", request.url));
  }

  return NextResponse.redirect(data.url);
}
