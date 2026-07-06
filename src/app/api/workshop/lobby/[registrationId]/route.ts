// GET /api/workshop/lobby/[registrationId] — the lobby state (PA-POS-38 §24.4). Locked until
// T-15 minutes; open returns the countdown target + the welcome-loop embed; live tells the client
// to move to the player. The registration id is the capability — no login mid-funnel.

import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkshopRegistration } from "@/lib/workshop/db";
import { lobbyPhase } from "@/lib/workshop/slots";
import { signStreamToken, streamConfig, streamIframeSrc } from "@/lib/workshop/stream";
import { formatSlotDisplay } from "@/lib/workshop/provision";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const idSchema = z.string().uuid();

const LOBBY_TOKEN_TTL_SECONDS = 30 * 60;

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
    console.error("[workshop/lobby] registration lookup failed", {
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
  const phase = lobbyPhase(slotAtMs, Date.now());

  let welcomeEmbedSrc: string | null = null;
  if (phase === "open" || phase === "live") {
    const config = streamConfig();
    if (config?.lobbyVideoUid) {
      const token = signStreamToken(config, config.lobbyVideoUid, LOBBY_TOKEN_TTL_SECONDS);
      welcomeEmbedSrc = streamIframeSrc(token, { autoplay: true, muted: true, loop: true });
    }
  }

  return NextResponse.json({
    phase,
    slot_at: reg.data.chosen_slot_at,
    slot_display: formatSlotDisplay(reg.data.chosen_slot_at, reg.data.timezone),
    timezone: reg.data.timezone,
    welcome_embed_src: welcomeEmbedSrc,
  });
}
