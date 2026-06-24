// DELETE /api/app/pocket-capture/api-tokens/[id] — revoke one of the signed-in user's API tokens
// (PC-CORE-4). Soft delete (sets revoked_at); the row stays for audit. Owner-scoped in the data
// layer (id AND owner_id), so a user can only ever revoke their own token. A 404 means the id
// wasn't theirs or was already revoked.

import { createClient } from "@/lib/supabase/server";
import { revokeApiToken } from "@/lib/pocket-capture/api-tokens";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await revokeApiToken(params.id, user.id);
  if (!result.ok) {
    console.error("[api-tokens] revoke failed", { ownerId: user.id, error: result.error });
    return NextResponse.json({ error: "Could not revoke token" }, { status: result.status });
  }
  if (!result.data.revoked) {
    return NextResponse.json({ error: "Token not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
