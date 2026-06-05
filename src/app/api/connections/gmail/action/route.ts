import { createClient } from "@/lib/supabase/server";
import { archiveThread, ensureFreshAccessToken } from "@/lib/gmail";
import {
  fetchGmailConnectionFull,
  markGmailConnectionError,
} from "@/lib/pa-gmail-connections";
import { resolveGmailTriageByThread } from "@/lib/pa-inbox-items";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Both 'archive' and 'handle' archive the Gmail thread (remove the INBOX label)
// and dismiss the Inbox item. The action flag is preserved as a distinct intent
// for telemetry — "I'll handle it elsewhere" vs. "Archive, no reply needed".
const BodySchema = z.object({
  threadId: z.string().min(1).max(200),
  action: z.enum(["archive", "handle"]),
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
  const { threadId, action } = parsed.data;

  const found = await fetchGmailConnectionFull(user.id);
  if (!found.ok) return NextResponse.json({ error: found.error }, { status: found.status });
  if (!found.data || found.data.status === "revoked") {
    return NextResponse.json({ error: "Gmail is not connected" }, { status: 409 });
  }

  const token = await ensureFreshAccessToken(found.data);
  if (!token.ok) {
    if (token.authError) await markGmailConnectionError(found.data.id);
    return NextResponse.json(
      { error: "Gmail authorization expired — reconnect Gmail in Settings." },
      { status: 502 },
    );
  }

  const archived = await archiveThread(token.data, threadId);
  if (!archived.ok) {
    if (archived.authError) await markGmailConnectionError(found.data.id);
    return NextResponse.json({ error: "Couldn't archive the thread in Gmail." }, { status: 502 });
  }

  // Dismiss the staged Inbox item. A missing row (already handled) is not an error.
  const resolved = await resolveGmailTriageByThread(user.id, threadId, user.id);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  return NextResponse.json({ ok: true, action, dismissed: resolved.data });
}
