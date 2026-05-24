import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safePath(raw: string | null): string {
  if (typeof raw !== "string" || raw === "") return "/app/onboarding";
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : "/app/onboarding";
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin = new URL(request.url).origin;
  const next = safePath(request.nextUrl.searchParams.get("next"));
  const supabase = createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo: `${origin}/app/auth/callback?next=${encodeURIComponent(next)}`,
      scopes: "repo read:user",
    },
  });

  if (error || !data.url) {
    return NextResponse.redirect(new URL("/app/login?error=oauth_init_failed", request.url));
  }

  return NextResponse.redirect(data.url);
}
