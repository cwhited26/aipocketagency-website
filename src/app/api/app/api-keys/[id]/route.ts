// DELETE /api/app/api-keys/<id> — revoke (soft-delete) a key. All subsequent REST
// requests with that key return 401.

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { revokeApiKey } from "@/lib/api-keys/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const idSchema = z.string().uuid();

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = idSchema.safeParse(params.id);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid key id" }, { status: 422 });
  }

  const revoked = await revokeApiKey(parsed.data, user.id);
  if (!revoked) {
    return NextResponse.json({ error: "Key not found or already revoked." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
