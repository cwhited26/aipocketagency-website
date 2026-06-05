import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { fetchTelos, saveTelos, TelosInputSchema, type TelosFields } from "@/lib/brain/telos";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type NorthStarGetResponse =
  | { exists: false }
  | { exists: true; fields: TelosFields };

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

  const fields = await fetchTelos(brain_repo, github_token);
  const response: NorthStarGetResponse = fields
    ? { exists: true, fields }
    : { exists: false };
  return NextResponse.json(response);
}

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
  const { brain_repo, github_token } = paResult.data;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = TelosInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await saveTelos({
    repo: brain_repo,
    token: github_token,
    fields: parsed.data.fields,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true, sha: result.sha });
}
