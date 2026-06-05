import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import {
  listSpecs,
  fetchSpec,
  saveSpec,
  SpecInputSchema,
  type SpecListItem,
  type SpecFields,
} from "@/lib/brain/isa";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type SpecsListResponse = { specs: SpecListItem[] };
export type SpecGetResponse =
  | { exists: false }
  | { exists: true; scope: string; fields: SpecFields };

// GET            → list all SPEC.md files in the brain
// GET ?scope=... → read one spec's sections (scope "" = repo root)
export async function GET(request: Request): Promise<NextResponse> {
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

  const url = new URL(request.url);
  const hasScope = url.searchParams.has("scope");

  if (hasScope) {
    const scope = url.searchParams.get("scope") ?? "";
    const fields = await fetchSpec(brain_repo, github_token, scope);
    const response: SpecGetResponse = fields
      ? { exists: true, scope, fields }
      : { exists: false };
    return NextResponse.json(response);
  }

  const specs = await listSpecs(brain_repo, github_token);
  const response: SpecsListResponse = { specs };
  return NextResponse.json(response);
}

// POST → create or update a spec at <scope>/SPEC.md
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

  const parsed = SpecInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await saveSpec({
    repo: brain_repo,
    token: github_token,
    scope: parsed.data.scope,
    fields: parsed.data.fields,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true, sha: result.sha, path: result.path });
}
