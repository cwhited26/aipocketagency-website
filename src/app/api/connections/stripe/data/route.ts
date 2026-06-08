// GET /api/connections/stripe/data?action=list_customers|list_invoices|get_balance&...
// Read-only surface for the Stripe connector's read actions. Reads bypass the approval Inbox
// (roadmap §2.4), so they execute immediately against the connected account. Write actions
// (create_invoice / create_payment_link / refund_charge) are NOT reachable here — they must be
// staged + approved through the orchestrator approval route. This endpoint 400s any non-read
// action so a write can never sneak through a GET.

import { createClient } from "@/lib/supabase/server";
import { executeStripeAction, isStripeAction, isStripeReadOnly } from "@/lib/connectors/stripe";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const action = sp.get("action") ?? "";
  if (!isStripeAction(action) || !isStripeReadOnly(action)) {
    return NextResponse.json(
      { error: "Unknown or non-read Stripe action. Writes must be approved, not read here." },
      { status: 400 },
    );
  }

  const payload: Record<string, unknown> = {};
  const limitRaw = sp.get("limit");
  if (limitRaw !== null) {
    const n = Number.parseInt(limitRaw, 10);
    if (Number.isFinite(n)) payload.limit = n;
  }
  if (action === "list_invoices") {
    if (sp.has("customer")) payload.customer = sp.get("customer");
    if (sp.has("status")) payload.status = sp.get("status");
  }

  const result = await executeStripeAction({
    userId: user.id,
    action,
    payload,
    ownerEmail: user.email ?? null,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data);
}
