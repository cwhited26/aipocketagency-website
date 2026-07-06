// POST /api/workshop/chat-messages — logs real attendee chat for Chase's later review
// (PA-POS-38 §24.4). Never surfaces in the fake-live feed; the client shows the scripted
// auto-reply locally. No live moderation.

import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkshopRegistration, insertWorkshopChatMessage } from "@/lib/workshop/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  registration_id: z.string().uuid(),
  sender_name: z.string().min(1).max(80),
  message: z.string().min(1).max(2000),
});

export async function POST(req: Request): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 422 });
  }

  const reg = await getWorkshopRegistration(parsed.data.registration_id);
  if (!reg.ok || !reg.data) {
    return NextResponse.json({ error: "unknown registration" }, { status: 404 });
  }

  const inserted = await insertWorkshopChatMessage({
    registrationId: parsed.data.registration_id,
    senderName: parsed.data.sender_name.trim(),
    message: parsed.data.message.trim(),
  });
  if (!inserted.ok) {
    console.error("[workshop/chat] insert failed", {
      registration_id: parsed.data.registration_id,
      status: inserted.status,
      error: inserted.error,
    });
    return NextResponse.json({ error: "could not log message" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
