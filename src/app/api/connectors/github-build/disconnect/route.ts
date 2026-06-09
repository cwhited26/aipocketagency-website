import { createClient } from "@/lib/supabase/server";
import { revokeGithubBuildConnection } from "@/lib/pa-github-build-connections";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Soft-delete the owner's GitHub Build connection: flip status to 'revoked' and wipe the stored
// token. (GitHub OAuth App tokens are revoked by the owner from their GitHub settings; PA simply
// stops holding the credential.) The row is retained for history — same model as the other
// connectors' disconnect routes.
export async function POST(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await revokeGithubBuildConnection(user.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
