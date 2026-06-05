// GET  /api/app/api-keys — list the user's API keys (sanitized; never the secret).
// POST /api/app/api-keys — generate a new key; returns the plaintext exactly once.

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { listApiKeysForUser } from "@/lib/api-keys/db";
import { createApiKeyForUser } from "@/lib/api-keys/keys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  // Optional per-key POST-origin allowlist (CORS for browser agents).
  scopes: z.array(z.string().trim().url().max(200)).max(20).optional(),
});

export async function GET(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await listApiKeysForUser(user.id);
  const keys = rows.map((k) => ({
    id: k.id,
    name: k.name,
    keyPrefix: k.key_prefix,
    scopes: k.scopes,
    createdAt: k.created_at,
    lastUsedAt: k.last_used_at,
    revokedAt: k.revoked_at,
  }));
  return NextResponse.json({ keys });
}

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
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 422 });
  }

  const { plaintext, row } = await createApiKeyForUser({
    userId: user.id,
    name: parsed.data.name,
    scopes: parsed.data.scopes ?? [],
  });

  return NextResponse.json(
    {
      // Shown to the user once — never retrievable again.
      plaintext,
      key: {
        id: row.id,
        name: row.name,
        keyPrefix: row.key_prefix,
        scopes: row.scopes,
        createdAt: row.created_at,
        lastUsedAt: row.last_used_at,
        revokedAt: row.revoked_at,
      },
    },
    { status: 201 },
  );
}
