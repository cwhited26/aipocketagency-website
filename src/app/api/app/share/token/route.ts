import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ShareTokenRow = {
  id: string;
  user_id: string;
  token: string;
  label: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

function sbEnv(): { url: string; key: string } | { error: string } {
  const url =
    process.env.POCKET_AGENT_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.WC_ADMIN_SUPABASE_URL;
  const key =
    process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.WC_ADMIN_SUPABASE_SERVICE_KEY;
  if (!url || !key) return { error: "Supabase env vars not set" };
  return { url: url.replace(/\/$/, ""), key };
}

function sbHeaders(key: string): Record<string, string> {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "return=minimal",
  };
}

async function getActiveToken(url: string, key: string, userId: string): Promise<ShareTokenRow | null> {
  const res = await fetch(
    `${url}/rest/v1/pocket_agent_share_tokens?user_id=eq.${encodeURIComponent(userId)}&revoked_at=is.null&order=created_at.desc&limit=1`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" },
  );
  if (!res.ok) return null;
  const rows = (await res.json()) as ShareTokenRow[];
  return rows[0] ?? null;
}

async function revokeAllTokens(url: string, key: string, userId: string): Promise<void> {
  await fetch(
    `${url}/rest/v1/pocket_agent_share_tokens?user_id=eq.${encodeURIComponent(userId)}&revoked_at=is.null`,
    {
      method: "PATCH",
      headers: sbHeaders(key),
      body: JSON.stringify({ revoked_at: new Date().toISOString() }),
      cache: "no-store",
    },
  );
}

async function insertToken(
  url: string,
  key: string,
  userId: string,
  token: string,
  label: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch(`${url}/rest/v1/pocket_agent_share_tokens`, {
    method: "POST",
    headers: { ...sbHeaders(key), Prefer: "return=minimal" },
    body: JSON.stringify({ user_id: userId, token, label }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, error: `DB insert failed (${res.status})` };
  return { ok: true };
}

// ─── GET /api/app/share/token ─────────────────────────────────────────────────
// Returns { hasToken: boolean } — never returns the token value.
export async function GET(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const env = sbEnv();
  if ("error" in env) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const existing = await getActiveToken(env.url, env.key, user.id);
  return NextResponse.json({ hasToken: Boolean(existing) });
}

const PostBodySchema = z.object({
  action: z.enum(["generate", "regenerate"]).default("generate"),
  label: z.string().max(100).optional(),
});

// ─── POST /api/app/share/token ────────────────────────────────────────────────
// action=generate: creates a new token (no-op if one already exists — use regenerate).
// action=regenerate: revokes existing, issues a new one.
// Returns { token: string } ONCE — this is the only time the value is returned.
export async function POST(req: Request): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof PostBodySchema>;
  try {
    const raw = (await req.json().catch(() => ({}))) as unknown;
    body = PostBodySchema.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const env = sbEnv();
  if ("error" in env) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  if (body.action === "generate") {
    const existing = await getActiveToken(env.url, env.key, user.id);
    if (existing) {
      return NextResponse.json(
        { error: "Token already exists. Use action=regenerate to replace it." },
        { status: 409 },
      );
    }
  }

  if (body.action === "regenerate") {
    await revokeAllTokens(env.url, env.key, user.id);
  }

  const newToken = randomBytes(32).toString("base64url");
  const label = body.label ?? "iOS Share";
  const insertResult = await insertToken(env.url, env.key, user.id, newToken, label);
  if (!insertResult.ok) {
    return NextResponse.json({ error: insertResult.error }, { status: 502 });
  }

  return NextResponse.json({ token: newToken });
}
