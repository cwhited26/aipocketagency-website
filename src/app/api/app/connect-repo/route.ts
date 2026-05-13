import { createClient } from "@/lib/supabase/server";
import { upsertPaUser } from "@/lib/pa-supabase";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REPO_RE = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;

type GhUser = { login: string };

export async function POST(req: Request): Promise<NextResponse> {
  let body: { repo?: unknown };
  try {
    body = (await req.json()) as { repo?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const repo = typeof body.repo === "string" ? body.repo.trim() : "";
  if (!repo || !REPO_RE.test(repo)) {
    return NextResponse.json({ error: "Invalid repo format. Use owner/name." }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Grab the GitHub OAuth token from the session
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const providerToken = session?.provider_token ?? null;

  // Fetch GitHub username (fail open — use email prefix if unavailable)
  let githubUsername = user.user_metadata?.user_name as string | undefined;
  if (!githubUsername && providerToken) {
    try {
      const ghRes = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${providerToken}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "pocket-agent/1.0",
        },
        cache: "no-store",
      });
      if (ghRes.ok) {
        const ghUser = (await ghRes.json()) as GhUser;
        githubUsername = ghUser.login;
      }
    } catch {
      // non-fatal
    }
  }
  githubUsername = githubUsername ?? repo.split("/")[0];

  const result = await upsertPaUser({
    id: user.id,
    github_username: githubUsername,
    brain_repo: repo,
    github_token: providerToken,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, repo });
}
