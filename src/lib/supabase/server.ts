import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { crossSubdomainCookieDomain } from "@/lib/app-subdomain/cookies";

export function createClient() {
  const cookieStore = cookies();
  // Scope auth cookies to `.aipocketagent.com` in production so a session is shared between
  // the apex and the app subdomain; undefined (host-scoped) in dev / preview.
  const cookieDomain = crossSubdomainCookieDomain(
    headers().get("host"),
    process.env.NODE_ENV,
  );
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(
                name,
                value,
                cookieDomain ? { ...options, domain: cookieDomain } : options,
              ),
            );
          } catch {
            // Server Component — middleware handles session refresh
          }
        },
      },
    },
  );
}
