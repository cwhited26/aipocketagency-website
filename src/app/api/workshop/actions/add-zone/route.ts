// POST /api/workshop/actions/add-zone — the zone "build with me" buttons (PA-POS-38 §24.4,
// minutes 20–40). The attendee pastes their content; PA writes it into their forked repo via the
// GitHub Contents API and stamps zones_completed on the attendance row.

import { NextResponse } from "next/server";
import { z } from "zod";
import { decrypt } from "@/lib/crypto/encrypt";
import { WORKSHOP_ZONES } from "@/data/workshop/action-script";
import {
  getWorkshopAttendance,
  markWorkshopZoneCompleted,
  upsertWorkshopAttendance,
} from "@/lib/workshop/db";
import { putZoneFile } from "@/lib/workshop/github";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  registration_id: z.string().uuid(),
  zone: z.enum(WORKSHOP_ZONES),
  content: z.string().min(1).max(100_000),
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
  const { registration_id, zone, content } = parsed.data;

  const attendance = await getWorkshopAttendance(registration_id);
  if (!attendance.ok) {
    console.error("[workshop/add-zone] attendance lookup failed", {
      registration_id,
      status: attendance.status,
      error: attendance.error,
    });
    return NextResponse.json({ error: "lookup failed" }, { status: 502 });
  }
  if (!attendance.data?.forked_repo_full_name || !attendance.data.github_token_encrypted) {
    return NextResponse.json(
      { error: "Fork the template repo first — the fork button is above this one." },
      { status: 409 },
    );
  }

  let token: string;
  try {
    token = decrypt(attendance.data.github_token_encrypted);
  } catch (err) {
    console.error("[workshop/add-zone] token decrypt failed", {
      registration_id,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "GitHub connection lost — re-run the fork button" }, { status: 409 });
  }

  const write = await putZoneFile({
    token,
    repoFullName: attendance.data.forked_repo_full_name,
    zone,
    content,
  });
  if (!write.ok) {
    console.error("[workshop/add-zone] contents write failed", {
      registration_id,
      zone,
      status: write.status,
      error: write.error,
    });
    return NextResponse.json({ error: "write failed — try Save again" }, { status: 502 });
  }

  const marked = await markWorkshopZoneCompleted(registration_id, zone);
  if (!marked.ok) {
    console.error("[workshop/add-zone] zone stamp failed", {
      registration_id,
      zone,
      status: marked.status,
      error: marked.error,
    });
  }
  const touched = await upsertWorkshopAttendance(registration_id, {
    last_active_at: new Date().toISOString(),
  });
  if (!touched.ok) {
    console.error("[workshop/add-zone] last_active stamp failed", {
      registration_id,
      status: touched.status,
    });
  }

  return NextResponse.json({ ok: true, path: write.data.path });
}
