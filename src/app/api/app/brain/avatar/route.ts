import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { commitMemoryFile, fetchFileContent } from "@/lib/pa-brain";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AVATAR_PATH = "memory/customer-avatar.md";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type AvatarFields = {
  whoTheyAre: string;
  whatTheyWant: string;
  fearsFrustrations: string;
  whereTheySpendTime: string;
  anythingElse: string;
};

export type AvatarGetResponse =
  | { exists: false }
  | { exists: true; fields: AvatarFields };

// ─── Parsing ───────────────────────────────────────────────────────────────────

function parseAvatarMarkdown(md: string): AvatarFields {
  const headerMap: Record<string, keyof AvatarFields> = {
    "Who they are": "whoTheyAre",
    "What they want": "whatTheyWant",
    "What they're afraid of / frustrated by": "fearsFrustrations",
    "Where they spend time": "whereTheySpendTime",
    "Anything else": "anythingElse",
  };

  const sections: Partial<AvatarFields> = {};
  let currentField: keyof AvatarFields | null = null;
  const lines: string[] = [];
  const rawLines = md.split("\n");

  for (const line of rawLines) {
    if (line.startsWith("## ")) {
      if (currentField && lines.length > 0) {
        sections[currentField] = lines.join("\n").trim();
        lines.length = 0;
      }
      const heading = line.slice(3).trim();
      currentField = headerMap[heading] ?? null;
    } else if (currentField) {
      lines.push(line);
    }
  }
  if (currentField && lines.length > 0) {
    sections[currentField] = lines.join("\n").trim();
  }

  return {
    whoTheyAre: sections.whoTheyAre ?? "",
    whatTheyWant: sections.whatTheyWant ?? "",
    fearsFrustrations: sections.fearsFrustrations ?? "",
    whereTheySpendTime: sections.whereTheySpendTime ?? "",
    anythingElse: sections.anythingElse ?? "",
  };
}

function buildAvatarMarkdown(fields: AvatarFields): string {
  return [
    "# Customer Avatar\n",
    "## Who they are",
    fields.whoTheyAre,
    "",
    "## What they want",
    fields.whatTheyWant,
    "",
    "## What they're afraid of / frustrated by",
    fields.fearsFrustrations,
    "",
    "## Where they spend time",
    fields.whereTheySpendTime || "_Not specified_",
    "",
    "## Anything else",
    fields.anythingElse || "_Nothing additional_",
  ].join("\n");
}

// ─── Zod schema ────────────────────────────────────────────────────────────────

const AvatarInputSchema = z.object({
  whoTheyAre: z.string().min(1, "Required").max(2000),
  whatTheyWant: z.string().min(1, "Required").max(2000),
  fearsFrustrations: z.string().min(1, "Required").max(2000),
  whereTheySpendTime: z.string().max(2000).optional().default(""),
  anythingElse: z.string().max(2000).optional().default(""),
});

// ─── GET — read current avatar ─────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const paResult = await fetchPaUser(user.id);
  if (!paResult.ok || !paResult.data?.brain_repo) {
    return NextResponse.json({ error: "No brain connected" }, { status: 404 });
  }

  const { brain_repo, github_token } = paResult.data;
  const raw = await fetchFileContent(brain_repo, AVATAR_PATH, github_token);

  if (!raw) {
    const response: AvatarGetResponse = { exists: false };
    return NextResponse.json(response);
  }

  const fields = parseAvatarMarkdown(raw);
  const response: AvatarGetResponse = { exists: true, fields };
  return NextResponse.json(response);
}

// ─── POST — save avatar ────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const paResult = await fetchPaUser(user.id);
  if (!paResult.ok || !paResult.data?.brain_repo) {
    return NextResponse.json({ error: "No brain connected" }, { status: 404 });
  }
  if (!paResult.data.github_token) {
    return NextResponse.json({ error: "GitHub not connected" }, { status: 403 });
  }

  const body: unknown = await request.json();
  const parsed = AvatarInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { brain_repo, github_token } = paResult.data;
  const markdown = buildAvatarMarkdown(parsed.data);

  const result = await commitMemoryFile({
    repo: brain_repo,
    token: github_token,
    path: AVATAR_PATH,
    mode: "replace",
    content: markdown,
    commitMessage: "brain: update customer avatar",
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sha: result.sha });
}
