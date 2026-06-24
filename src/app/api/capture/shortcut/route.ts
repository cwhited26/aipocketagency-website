// POST /api/capture/shortcut — the iOS Shortcut + Siri voice capture surface (PC-CORE-4).
//
// The published "Pocket Capture" Shortcut dictates text and POSTs it here with the user's personal
// API token: `Authorization: Bearer pca_…`. We:
//   1. verify the bearer token → owner id (verifyApiToken, constant-time, revoked tokens rejected),
//   2. parse the JSON body { text, source_hint? } (Zod boundary),
//   3. dedup re-fires (identical text from the same owner inside a 5-second bucket is a no-op),
//   4. resolve the owner's brain credentials and write to the Capture Inbox (source="voice_shortcut"),
//   5. return { success, capture_id } as JSON the Shortcut shows in its confirmation notification.
//
// This is a DISTINCT surface from /capture/share (PC-CORE-1), which uses PWA cookie-session auth.
// This endpoint is called from outside any browser session, so it authenticates by bearer token only.

import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { verifyApiToken } from "@/lib/pocket-capture/api-tokens";
import { writeVoiceShortcutCapture } from "@/lib/pocket-capture/voice-capture";
import { fetchPaUser } from "@/lib/pa-supabase";
import {
  computeIdempotencyKey,
  markAndCheckDuplicate,
} from "@/lib/capture-share/idempotency";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The Shortcut sends a short dictated string. Cap the length defensively so a runaway payload can't
// bloat the brain commit; 8k chars is far beyond any real dictation.
const BodySchema = z.object({
  text: z.string().min(1, "text is required").max(8000),
  source_hint: z.string().max(120).optional(),
});

/** Pull the bearer token out of the Authorization header, or null when absent / malformed. */
function bearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export async function POST(req: Request): Promise<NextResponse> {
  // 1. Authenticate via the personal API token.
  const token = bearerToken(req);
  if (!token) {
    return NextResponse.json(
      { success: false, error: "Missing Authorization: Bearer token" },
      { status: 401 },
    );
  }
  const auth = await verifyApiToken(token);
  if (!auth) {
    return NextResponse.json({ success: false, error: "Invalid or revoked token" }, { status: 401 });
  }

  // 2. Parse the JSON body.
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Body must be JSON" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Invalid body" },
      { status: 400 },
    );
  }
  const { text, source_hint: sourceHint } = parsed.data;

  // 3. Dedup re-fires: identical text from the same owner inside a 5-second bucket is a no-op.
  const nowMs = Date.now();
  const captureId = crypto.randomUUID();
  const idempotencyKey = computeIdempotencyKey({ ownerId: auth.ownerId, text, nowMs });
  if (markAndCheckDuplicate(idempotencyKey, nowMs)) {
    return NextResponse.json({ success: true, capture_id: captureId, duplicate: true });
  }

  // 4. Resolve the owner's brain credentials.
  const paResult = await fetchPaUser(auth.ownerId);
  if (!paResult.ok) {
    console.error("[capture/shortcut] could not load account", {
      ownerId: auth.ownerId,
      error: paResult.error,
    });
    return NextResponse.json(
      { success: false, error: "Could not load your account. Try again shortly." },
      { status: 502 },
    );
  }
  if (!paResult.data) {
    return NextResponse.json({ success: false, error: "Account not found" }, { status: 404 });
  }
  const paUser = paResult.data;

  // 5. Write to the Capture Inbox (source="voice_shortcut").
  const result = await writeVoiceShortcutCapture({
    owner: { id: paUser.id, brain_repo: paUser.brain_repo, github_token: paUser.github_token },
    text,
    sourceHint,
  });
  if (!result.ok) {
    if (result.reason === "no-brain") {
      return NextResponse.json(
        { success: false, error: "Connect your brain in Pocket Agent, then capture again." },
        { status: 409 },
      );
    }
    if (result.reason === "empty") {
      return NextResponse.json({ success: false, error: "Nothing to capture" }, { status: 400 });
    }
    console.error("[capture/shortcut] capture write failed", {
      ownerId: auth.ownerId,
      reason: result.reason,
      error: result.error,
    });
    return NextResponse.json(
      { success: false, error: "Couldn't save that. Try again shortly." },
      { status: 502 },
    );
  }

  return NextResponse.json({ success: true, capture_id: captureId });
}
