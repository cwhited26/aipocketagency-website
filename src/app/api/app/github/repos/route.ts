import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GhRepo = {
  full_name: string;
  private: boolean;
  updated_at: string;
  pushed_at: string;
};

type GhRepoSlim = { full_name: string; private: boolean };

export async function GET(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.provider_token;
  if (!token) {
    // Session has no provider_token (common after refresh) — fall back to empty list
    // so the onboarding UI switches to manual entry
    return NextResponse.json([], { status: 200 });
  }

  const res = await fetch(
    "https://api.github.com/user/repos?per_page=100&sort=pushed&affiliation=owner",
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "pocket-agent/1.0",
      },
      cache: "no-store",
    },
  );

  if (!res.ok) {
    return NextResponse.json([], { status: 200 }); // fail open
  }

  const repos = (await res.json()) as GhRepo[];
  const slim: GhRepoSlim[] = repos.map((r) => ({
    full_name: r.full_name,
    private: r.private,
  }));

  return NextResponse.json(slim);
}
