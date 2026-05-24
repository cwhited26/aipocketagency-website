import { createClient } from "@/lib/supabase/server";
import { upsertPaUser } from "@/lib/pa-supabase";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GitHub repo names: alphanumeric, dash, underscore, dot; max 100 chars
const REPO_NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,99}$/;

const BodySchema = z.object({
  repoName: z
    .string()
    .min(1, "Repo name is required")
    .regex(REPO_NAME_RE, "Repo name must start with a letter or number and contain only letters, numbers, dashes, underscores, or dots"),
});

type GhUser = { login: string };
type GhGenerateResp = { full_name: string };
type GhError = { message?: string; errors?: Array<{ message: string }> };

export async function POST(req: Request): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 422 },
    );
  }
  const { repoName } = parsed.data;

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
  const token = session?.provider_token ?? null;
  if (!token) {
    return NextResponse.json(
      {
        error:
          "GitHub connection required to create a brain repo. Sign out and sign back in with GitHub.",
      },
      { status: 403 },
    );
  }

  // Resolve GitHub username from metadata or API
  let githubUsername = user.user_metadata?.user_name as string | undefined;
  if (!githubUsername) {
    const ghRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "pocket-agent/1.0",
      },
      cache: "no-store",
    });
    if (!ghRes.ok) {
      return NextResponse.json(
        { error: "Could not verify your GitHub account. Try signing out and back in." },
        { status: 502 },
      );
    }
    const ghUser = (await ghRes.json()) as GhUser;
    githubUsername = ghUser.login;
  }
  if (!githubUsername) {
    return NextResponse.json(
      { error: "Could not determine GitHub username." },
      { status: 500 },
    );
  }

  // Generate new repo from the brain template
  const generateRes = await fetch(
    "https://api.github.com/repos/cwhited26/pocket-agent-brain/generate",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "pocket-agent/1.0",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        owner: githubUsername,
        name: repoName,
        description: "My Pocket Agent brain — business context, decisions, and memory",
        private: true,
        include_all_branches: false,
      }),
      cache: "no-store",
    },
  );

  if (!generateRes.ok) {
    const errText = await generateRes.text();
    let errMsg = `GitHub returned ${generateRes.status}. Try again.`;

    if (generateRes.status === 422) {
      try {
        const ghErr = JSON.parse(errText) as GhError;
        const detail = ghErr.errors?.[0]?.message ?? ghErr.message ?? "";
        if (detail.toLowerCase().includes("already exists") || detail.toLowerCase().includes("name")) {
          errMsg = `A repo named "${repoName}" already exists in your account. Try a different name.`;
        } else if (detail) {
          errMsg = detail;
        } else {
          errMsg = `A repo named "${repoName}" already exists or the name is invalid. Try a different name.`;
        }
      } catch {
        errMsg = `A repo named "${repoName}" already exists or the name is invalid. Try a different name.`;
      }
      return NextResponse.json({ error: errMsg }, { status: 422 });
    }

    if (generateRes.status === 403 || generateRes.status === 401) {
      return NextResponse.json(
        {
          error:
            "GitHub token doesn't have permission to create repos. Sign out and reconnect GitHub.",
        },
        { status: 403 },
      );
    }

    if (generateRes.status === 404) {
      return NextResponse.json(
        { error: "Brain template not found. Contact support." },
        { status: 502 },
      );
    }

    return NextResponse.json({ error: errMsg }, { status: 502 });
  }

  const generated = (await generateRes.json()) as GhGenerateResp;
  const fullRepo = generated.full_name; // e.g. "chasewhited/my-pocket-brain"

  const upsertResult = await upsertPaUser({
    id: user.id,
    github_username: githubUsername,
    brain_repo: fullRepo,
    github_token: token,
  });
  if (!upsertResult.ok) {
    return NextResponse.json({ error: upsertResult.error }, { status: upsertResult.status });
  }

  return NextResponse.json({ ok: true, repo: fullRepo });
}
