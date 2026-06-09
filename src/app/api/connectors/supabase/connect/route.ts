// POST /api/connectors/supabase/connect  { pat }
// The owner pastes their Supabase Personal Access Token (Management API — generated at
// supabase.com/dashboard/account/tokens). We validate it by listing their organizations, capture
// the default org for createProject, and store the token AES-256-GCM-encrypted (never plaintext).

import { createClient } from "@/lib/supabase/server";
import { listOrganizations } from "@/lib/connectors/supabase/api";
import { upsertSupabaseConnection } from "@/lib/pa-supabase-connections";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  // Supabase PATs are prefixed `sbp_`; we accept any non-trivial token and let the API be the
  // real validator (a format check here would only add a way to reject a valid future format).
  pat: z.string().min(20, "That doesn't look like a Supabase access token.").max(400),
});

export async function POST(req: Request): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 422 });
  }
  const pat = parsed.data.pat.trim();

  // Validate against the Management API before persisting anything.
  const orgs = await listOrganizations(pat);
  if (!orgs.ok) {
    const message = orgs.authError
      ? "That access token was rejected by Supabase. Generate a new one at supabase.com/dashboard/account/tokens and paste it again."
      : `Couldn't verify the token with Supabase (${orgs.status}). Try again.`;
    return NextResponse.json({ error: message }, { status: orgs.authError ? 401 : 502 });
  }
  if (orgs.data.length === 0) {
    return NextResponse.json(
      { error: "This token has no Supabase organizations. Create an organization first, then reconnect." },
      { status: 422 },
    );
  }

  const defaultOrg = orgs.data[0];
  const saved = await upsertSupabaseConnection({
    userId: user.id,
    pat,
    orgId: defaultOrg.id,
    orgName: defaultOrg.name,
  });
  if (!saved.ok) {
    return NextResponse.json({ error: saved.error }, { status: saved.status });
  }

  return NextResponse.json({
    status: "connected",
    org: { id: defaultOrg.id, name: defaultOrg.name },
    orgCount: orgs.data.length,
  });
}
