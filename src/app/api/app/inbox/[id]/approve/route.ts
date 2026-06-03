import { createClient } from "@/lib/supabase/server";
import {
  fetchInboxItemById,
  resolveInboxItem,
  type InboxItem,
} from "@/lib/pa-inbox-items";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// What the client should do once an item is approved.
//   • email  — open the user's mail client (mailto) pre-filled, and/or copy the
//              body. Live Gmail send is gated on a send adapter that ships with
//              Connections; until then approval hands the send back to the user.
//   • noop   — nothing further (generic draft / decision); the row is recorded.
type SendInstruction =
  | { method: "mailto"; to: string; subject: string; body: string; mailto: string }
  | { method: "noop" };

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function buildSend(item: InboxItem): SendInstruction {
  if (item.kind === "draft" && item.source === "email-drafter") {
    const to = str(item.payload.to);
    const subject = str(item.payload.subject);
    const body = str(item.payload.body) || item.body_md || "";
    const query = new URLSearchParams();
    if (subject) query.set("subject", subject);
    if (body) query.set("body", body);
    const qs = query.toString();
    const mailto = `mailto:${encodeURIComponent(to)}${qs ? `?${qs}` : ""}`;
    return { method: "mailto", to, subject, body, mailto };
  }
  return { method: "noop" };
}

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = params;

  const found = await fetchInboxItemById(id);
  if (!found.ok) return NextResponse.json({ error: found.error }, { status: found.status });
  const item = found.data;
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Ownership gate (RLS is defense-in-depth; this is the real gate).
  if (item.user_id !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Idempotent: approving an already-approved item re-returns its send action so
  // a stale tab can still complete the hand-off.
  if (item.status === "approved") {
    return NextResponse.json({ status: "approved", send: buildSend(item) });
  }
  if (item.status !== "pending") {
    return NextResponse.json(
      { error: `Cannot approve an item that is '${item.status}'.` },
      { status: 409 },
    );
  }

  const resolved = await resolveInboxItem(id, "approved", user.id);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  return NextResponse.json({ status: "approved", send: buildSend(resolved.data) });
}
