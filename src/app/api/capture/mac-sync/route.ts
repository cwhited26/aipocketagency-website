// POST /api/capture/mac-sync — batch ingest for the Pocket Agent Capture Mac app (PA-CAPTURE-MAC
// v0.1). The menu-bar app (pa-capture-mac/) watches the clipboard + screenshot folders and uploads
// queued items here every 30s, authenticating with the user's personal API token:
// `Authorization: Bearer pca_…` — the SAME token the iOS Shortcut uses (no new auth surface).
//
// Flow:
//   1. verify the bearer token → owner id (verifyApiToken, constant-time, revoked tokens rejected),
//   2. parse the JSON body { items: MacCaptureItem[] } (Zod boundary),
//   3. resolve the owner's brain credentials,
//   4. writeMacCaptureBatch — durable per-item idempotency (claim-before-write) + one brain commit,
//   5. return per-item { hash, status } so the uploader knows exactly what to mark synced vs retry.
//
// Additive: this does NOT touch the existing email / SMS / shortcut handlers. It reuses their token
// auth (api-tokens), brain write path (pa-inbox + pa-brain), and Storage staging (storage.ts).

import { NextResponse } from "next/server";
import { verifyApiToken } from "@/lib/pocket-capture/api-tokens";
import { fetchPaUser } from "@/lib/pa-supabase";
import { MacSyncBodySchema, writeMacCaptureBatch } from "@/lib/pocket-capture/mac-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const parsed = MacSyncBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Invalid body" },
      { status: 400 },
    );
  }

  // 3. Resolve the owner's brain credentials.
  const paResult = await fetchPaUser(auth.ownerId);
  if (!paResult.ok) {
    console.error("[capture/mac-sync] could not load account", {
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

  // 4. Ingest the batch (idempotent claim-before-write + a single brain commit).
  const result = await writeMacCaptureBatch(
    { id: paUser.id, brain_repo: paUser.brain_repo, github_token: paUser.github_token },
    parsed.data.items,
  );

  if (!result.ok) {
    // No brain connected: keep everything queued on the client and retry later.
    return NextResponse.json(
      { success: false, error: "Connect your brain in Pocket Agent, then it will sync." },
      { status: 409 },
    );
  }

  // 5. Per-item outcomes. The client marks accepted/duplicate/rejected items synced, retries "error".
  const accepted = result.results.filter((r) => r.status === "accepted").length;
  const duplicates = result.results.filter((r) => r.status === "duplicate").length;
  const errored = result.results.filter((r) => r.status === "error");
  if (errored.length > 0) {
    console.error("[capture/mac-sync] some items failed", {
      ownerId: auth.ownerId,
      errored: errored.length,
      firstReason: errored[0]?.reason,
    });
  }

  return NextResponse.json({ success: true, accepted, duplicates, results: result.results });
}
