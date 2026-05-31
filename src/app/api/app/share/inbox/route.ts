import { NextResponse } from "next/server";
import { z } from "zod";
import { commitMemoryFile, fetchFileContent } from "@/lib/pa-brain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── Supabase service-role helpers (no session) ───────────────────────────────

type ShareTokenRow = {
  id: string;
  user_id: string;
  revoked_at: string | null;
};

type PaUserRow = {
  brain_repo: string | null;
  github_token: string | null;
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

function sbGet(url: string, key: string, path: string) {
  return fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
}

async function lookupShareToken(
  url: string,
  key: string,
  rawToken: string,
): Promise<ShareTokenRow | null> {
  const res = await sbGet(
    url,
    key,
    `pocket_agent_share_tokens?token=eq.${encodeURIComponent(rawToken)}&limit=1`,
  );
  if (!res.ok) return null;
  const rows = (await res.json()) as ShareTokenRow[];
  return rows[0] ?? null;
}

async function touchLastUsed(url: string, key: string, tokenId: string): Promise<void> {
  await fetch(
    `${url}/rest/v1/pocket_agent_share_tokens?id=eq.${encodeURIComponent(tokenId)}`,
    {
      method: "PATCH",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ last_used_at: new Date().toISOString() }),
      cache: "no-store",
    },
  );
}

async function fetchPaUserForShare(
  url: string,
  key: string,
  userId: string,
): Promise<PaUserRow | null> {
  const res = await sbGet(
    url,
    key,
    `pocket_agent_users?id=eq.${encodeURIComponent(userId)}&select=brain_repo,github_token&limit=1`,
  );
  if (!res.ok) return null;
  const rows = (await res.json()) as PaUserRow[];
  return rows[0] ?? null;
}

// ─── Payload validation ────────────────────────────────────────────────────────

const JsonPayloadSchema = z.object({
  kind: z.enum(["text", "url", "note"]),
  content: z.string().min(1).max(50_000),
  title: z.string().max(500).optional(),
  sourceUrl: z.string().url().optional(),
});

type JsonPayload = z.infer<typeof JsonPayloadSchema>;

// ─── Inbox formatting ─────────────────────────────────────────────────────────

function formatInboxEntry(payload: JsonPayload): string {
  const ts = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
  const kindLabel = payload.kind;
  const titleLine = payload.title ? `**${payload.title}**  ` : "";
  const contentSnip = payload.content.length > 500
    ? payload.content.slice(0, 500).trimEnd() + "…"
    : payload.content;
  const sourceStr = payload.sourceUrl ? `\n  _Source: ${payload.sourceUrl}_` : "";
  return `- **${ts}** · \`${kindLabel}\` ${titleLine}\n  ${contentSnip}${sourceStr}`;
}

function buildInboxContent(existing: string, newEntry: string): string {
  if (!existing.trim()) {
    return `# Inbox\n\nShared items from your iOS Shortcut — triage or delete when processed.\n\n${newEntry}\n`;
  }
  return `${existing.trimEnd()}\n\n${newEntry}\n`;
}

// ─── POST /api/app/share/inbox ────────────────────────────────────────────────
// Auth: Authorization: Bearer <share-token> (NOT a user session token)
// Body: application/json { kind, content, title?, sourceUrl? }
export async function POST(req: Request): Promise<NextResponse> {
  // Extract bearer token
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing Authorization header" }, { status: 401 });
  }
  const rawToken = authHeader.slice(7).trim();
  if (!rawToken) {
    return NextResponse.json({ error: "Empty token" }, { status: 401 });
  }

  const env = sbEnv();
  if ("error" in env) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  // Validate share token
  const tokenRow = await lookupShareToken(env.url, env.key, rawToken);
  if (!tokenRow || tokenRow.revoked_at !== null) {
    return NextResponse.json({ error: "Invalid or revoked token" }, { status: 401 });
  }

  // Parse and validate body (JSON only for now; file support via future multipart extension)
  const contentType = req.headers.get("content-type") ?? "";
  let payload: JsonPayload;
  if (contentType.includes("application/json")) {
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const parsed = JsonPayloadSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten().fieldErrors },
        { status: 422 },
      );
    }
    payload = parsed.data;
  } else {
    return NextResponse.json(
      { error: "Content-Type must be application/json" },
      { status: 415 },
    );
  }

  // Touch last_used_at (non-blocking; fire and don't await to keep latency low)
  void touchLastUsed(env.url, env.key, tokenRow.id);

  // Fetch user's brain config
  const paUser = await fetchPaUserForShare(env.url, env.key, tokenRow.user_id);
  if (!paUser || !paUser.brain_repo || !paUser.github_token) {
    return NextResponse.json(
      { error: "Brain repo not configured for this account" },
      { status: 400 },
    );
  }

  const { brain_repo: repo, github_token: ghToken } = paUser;
  const inboxPath = "memory/inbox.md";

  // Read existing inbox, append new entry, commit
  const existing = await fetchFileContent(repo, inboxPath, ghToken);
  const newEntry = formatInboxEntry(payload);
  const finalContent = buildInboxContent(existing, newEntry);

  const commitResult = await commitMemoryFile({
    repo,
    token: ghToken,
    path: inboxPath,
    mode: "replace",
    content: finalContent,
    commitMessage: `Pocket Agent — iOS share inbox: ${payload.kind} from shortcut`,
  });

  if (!commitResult.ok) {
    return NextResponse.json({ error: commitResult.error }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    path: inboxPath,
    sha: commitResult.sha,
  });
}
