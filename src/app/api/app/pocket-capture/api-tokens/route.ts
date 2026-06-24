// /api/app/pocket-capture/api-tokens — manage the signed-in user's personal API tokens for the
// iOS Shortcut capture surface (PC-CORE-4).
//
//   POST → mint a new token. Returns { token, token_prefix } with the plaintext ONCE — the client
//          must save it immediately; it is never recoverable afterwards.
//   GET  → list the user's active tokens (prefix + name + timestamps only, NEVER the plaintext/hash).
//
// Cookie-session authenticated (dashboard surface). The token-management UI lands in PC-CORE-6; this
// lane ships the endpoints + helpers.

import { createClient } from "@/lib/supabase/server";
import { generateApiToken, listApiTokens } from "@/lib/pocket-capture/api-tokens";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CreateSchema = z.object({
  name: z.string().trim().max(200).optional(),
});

export async function POST(req: Request): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Body is optional — a bare POST mints an unnamed token.
  let name: string | undefined;
  const raw = await req.text();
  if (raw.trim()) {
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
    }
    const parsed = CreateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid body" },
        { status: 400 },
      );
    }
    name = parsed.data.name;
  }

  const result = await generateApiToken(user.id, name);
  if (!result.ok) {
    console.error("[api-tokens] mint failed", { ownerId: user.id, error: result.error });
    return NextResponse.json({ error: "Could not create token" }, { status: result.status });
  }

  // The plaintext is returned exactly once — the client must save it now.
  return NextResponse.json(
    { token: result.data.tokenPlaintext, token_prefix: result.data.tokenPrefix },
    { status: 201 },
  );
}

export async function GET(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await listApiTokens(user.id);
  if (!result.ok) {
    console.error("[api-tokens] list failed", { ownerId: user.id, error: result.error });
    return NextResponse.json({ error: "Could not load tokens" }, { status: result.status });
  }

  return NextResponse.json({ tokens: result.data });
}
