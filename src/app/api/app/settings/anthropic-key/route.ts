import { createClient } from "@/lib/supabase/server";
import { upsertPaUserApiKey } from "@/lib/pa-supabase";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Anthropic keys begin with sk-ant- followed by at least 20 alphanumeric/dash/underscore chars
const ANTHROPIC_KEY_RE = /^sk-ant-[A-Za-z0-9_-]{20,}$/;

export async function POST(req: Request): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { key?: unknown };
  try {
    body = (await req.json()) as { key?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const key = typeof body.key === "string" ? body.key.trim() : "";
  if (!key) return NextResponse.json({ error: "key is required" }, { status: 400 });
  if (!ANTHROPIC_KEY_RE.test(key)) {
    return NextResponse.json(
      { error: "Invalid Anthropic API key format. Keys start with sk-ant-." },
      { status: 422 },
    );
  }

  const result = await upsertPaUserApiKey(user.id, key);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await upsertPaUserApiKey(user.id, null);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
