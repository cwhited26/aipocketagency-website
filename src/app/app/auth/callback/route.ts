import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { linkSubscriptionByEmail } from "@/lib/pocket-agent-supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/app/onboarding";

  if (!code) {
    return NextResponse.redirect(new URL("/app/login?error=no_code", request.url));
  }

  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        },
      },
    },
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL(`/app/login?error=${encodeURIComponent(error.message)}`, request.url),
    );
  }

  // Link any email-matched subscription row to this user_id so the
  // middleware's user_id check passes on first login (webhook creates the row
  // before the user has authenticated).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.email) {
    await linkSubscriptionByEmail(user.email, user.id);
  }

  return NextResponse.redirect(new URL(next, request.url));
}
