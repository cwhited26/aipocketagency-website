// GET /api/workshop/video-url/[registrationId] — a signed Cloudflare Stream URL for the workshop
// recording, 60-minute TTL (PA-POS-38 §24.4). Validates the attendee is registered and at their
// slot (T-0 through the grace window). Unprovisioned Stream env returns a clean 503 placeholder
// state the player renders — never a crash.

import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkshopRegistration, patchWorkshopRegistration, upsertWorkshopAttendance } from "@/lib/workshop/db";
import { canServeVideo } from "@/lib/workshop/slots";
import { signStreamToken, streamConfig, streamIframeSrc } from "@/lib/workshop/stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const idSchema = z.string().uuid();

const VIDEO_TOKEN_TTL_SECONDS = 60 * 60;

export async function GET(
  _req: Request,
  { params }: { params: { registrationId: string } },
): Promise<NextResponse> {
  const parsed = idSchema.safeParse(params.registrationId);
  if (!parsed.success) {
    return NextResponse.json({ error: "unknown registration" }, { status: 404 });
  }

  const reg = await getWorkshopRegistration(parsed.data);
  if (!reg.ok) {
    console.error("[workshop/video-url] registration lookup failed", {
      registration_id: parsed.data,
      status: reg.status,
      error: reg.error,
    });
    return NextResponse.json({ error: "lookup failed" }, { status: 502 });
  }
  if (!reg.data) {
    return NextResponse.json({ error: "unknown registration" }, { status: 404 });
  }

  const slotAtMs = Date.parse(reg.data.chosen_slot_at);
  if (!canServeVideo(slotAtMs, Date.now())) {
    return NextResponse.json(
      { error: "not at your slot", slot_at: reg.data.chosen_slot_at },
      { status: 403 },
    );
  }

  const config = streamConfig();
  if (!config?.workshopVideoUid) {
    return NextResponse.json(
      { error: "video not provisioned", state: "unprovisioned" },
      { status: 503 },
    );
  }

  // First video-url grab at the slot = attended. Idempotent status flip + attendance row.
  if (reg.data.session_status === "registered") {
    const flip = await patchWorkshopRegistration(parsed.data, { session_status: "attended" });
    if (!flip.ok) {
      console.error("[workshop/video-url] attended flip failed", {
        registration_id: parsed.data,
        status: flip.status,
      });
    }
    const att = await upsertWorkshopAttendance(parsed.data, {
      last_active_at: new Date().toISOString(),
    });
    if (!att.ok) {
      console.error("[workshop/video-url] attendance upsert failed", {
        registration_id: parsed.data,
        status: att.status,
      });
    }
  }

  const token = signStreamToken(config, config.workshopVideoUid, VIDEO_TOKEN_TTL_SECONDS);
  return NextResponse.json({
    embed_src: streamIframeSrc(token, { autoplay: true, muted: false, loop: false }),
    expires_in_sec: VIDEO_TOKEN_TTL_SECONDS,
  });
}
