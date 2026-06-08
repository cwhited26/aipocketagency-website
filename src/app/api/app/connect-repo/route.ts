import { createClient } from "@/lib/supabase/server";
import { upsertPaUser, fetchPaUser } from "@/lib/pa-supabase";
import { indexBrain } from "@/lib/pa-brain-index";
import { ensureInboundAddresses } from "@/lib/inbound-email/addresses";
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

  // provider_token is available right after OAuth; after session refresh it's dropped.
  // Fall back to the stored token from a "Connect GitHub" flow.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  let providerToken = session?.provider_token ?? null;
  if (!providerToken) {
    const paResult = await fetchPaUser(user.id);
    providerToken = paResult.ok && paResult.data ? paResult.data.github_token : null;
  }

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

  // Provision the owner's two inbound-email addresses (forwarding + BCC). Idempotent and
  // non-fatal — a failure here never blocks connecting the brain; the Connections page
  // re-ensures them on load.
  const addresses = await ensureInboundAddresses(user.id, githubUsername);
  if (!addresses.ok) {
    console.error("[connect-repo] inbound address provisioning failed", {
      userId: user.id,
      status: addresses.status,
      error: addresses.error,
    });
  }

  // Fire brain indexer for the newly connected repo.
  // Errors are non-fatal — connection succeeded regardless.
  const indexResult = await indexBrain({
    userId: user.id,
    repo,
    token: providerToken,
  });

  const indexSummary = indexResult.ok
    ? { indexed: indexResult.result.indexed, errors: indexResult.result.errors.length }
    : { indexed: 0, errors: 1 };

  return NextResponse.json({ ok: true, repo, index: indexSummary });
}
