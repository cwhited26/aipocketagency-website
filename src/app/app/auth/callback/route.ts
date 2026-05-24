import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { linkSubscriptionByEmail } from "@/lib/pocket-agent-supabase";
import { patchGithubToken } from "@/lib/pa-supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const rawNext = requestUrl.searchParams.get("next") ?? "/app/onboarding";
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/app/onboarding";

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.email) {
    await linkSubscriptionByEmail(user.email, user.id);
  }

  // If this was a GitHub OAuth flow, persist the provider_token to pocket_agent_users.
  // This enables magic-link users who later connect GitHub to use brain features.
  if (user) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const providerToken = session?.provider_token;
    if (providerToken) {
      const githubUsername =
        (user.user_metadata?.user_name as string | undefined) ??
        (user.user_metadata?.preferred_username as string | undefined);
      // Non-fatal: if the row doesn't exist yet, patchGithubToken will silently 0-match
      await patchGithubToken(user.id, providerToken, githubUsername);
    }
  }

  return NextResponse.redirect(new URL(next, request.url));
}
