// GET /api/pocket-capture/recent-purchases — the last few real Pocket Capture standalone purchases,
// anonymized to { city, purchased_at }, for the landing page's live social-proof toast (PC-MARK-4).
// The heavy lifting (ledger read, Stripe city lookup, 5-minute in-process cache, skipping entries
// with no resolvable city) lives in the pure-ish data layer; this route is just the boundary.

import { NextResponse } from "next/server";
import { getRecentPurchases } from "@/lib/pocket-capture/recent-purchases";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const purchases = await getRecentPurchases();
  return NextResponse.json(
    { purchases },
    // Edge/CDN cache mirrors the server-side 5-minute window so a viral landing page doesn't fan out
    // to Stripe on every view.
    { headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } },
  );
}
