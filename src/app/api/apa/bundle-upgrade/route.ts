import { NextResponse } from "next/server";
import {
  retrieveCheckoutSession,
  createBundleUpgradeCheckout,
} from "@/lib/stripe-checkout";
import { recordBundleUpgradeSession } from "@/lib/wc-admin-supabase";
import {
  BUNDLE_PRICING,
  KIT_RETAIL_USD,
  BUMP_USD,
  isKitSlug,
} from "@/lib/kit-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_ID_RE = /^cs_(test|live)_[A-Za-z0-9]+$/;

type BodyShape = {
  session_id?: unknown;
};

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(req: Request): Promise<NextResponse> {
  let body: BodyShape;
  try {
    body = (await req.json()) as BodyShape;
  } catch {
    return badRequest("Invalid JSON");
  }

  const sessionId =
    typeof body.session_id === "string" ? body.session_id.trim() : "";
  if (!SESSION_ID_RE.test(sessionId)) {
    return badRequest("Invalid session id");
  }

  const lookup = await retrieveCheckoutSession(sessionId);
  if (!lookup.ok) {
    console.error("[bundle-upgrade] Stripe retrieve failed", {
      session_id: sessionId,
      status: lookup.status,
      error: lookup.error,
    });
    return NextResponse.json(
      { error: "Could not load your original purchase. Please contact support." },
      { status: 502 },
    );
  }
  const session = lookup.session;
  const leadId = session.client_reference_id;
  const email = session.customer_email;
  const kitSlug = session.metadata?.kit_slug ?? session.metadata?.source;
  const bumpSlug = session.metadata?.bump_kit_slug ?? null;

  if (!leadId || !email || !kitSlug || !isKitSlug(kitSlug)) {
    console.error("[bundle-upgrade] origin session missing required fields", {
      session_id: sessionId,
      has_lead: !!leadId,
      has_email: !!email,
      kit_slug: kitSlug,
    });
    return NextResponse.json(
      { error: "Original session is missing required fields." },
      { status: 422 },
    );
  }
  if (session.payment_status !== "paid") {
    return NextResponse.json(
      { error: "Original session is not yet paid." },
      { status: 422 },
    );
  }

  // Compute delta from Stripe's amount_total when available; fall back to the
  // catalog math if Stripe didn't return a total for any reason.
  const paidCents = session.amount_total ?? 0;
  const expectedCents =
    (KIT_RETAIL_USD + (bumpSlug ? BUMP_USD : 0)) * 100;
  const effectiveCents = paidCents > 0 ? paidCents : expectedCents;
  const targetCents = BUNDLE_PRICING.offerUsd * 100;
  const deltaCents = targetCents - effectiveCents;
  if (deltaCents <= 0) {
    return NextResponse.json(
      { error: "You already paid the bundle price — your kits are on the way." },
      { status: 409 },
    );
  }

  const origin = new URL(req.url).origin;
  const checkout = await createBundleUpgradeCheckout(
    {
      leadId,
      email,
      originSlug: kitSlug,
      originSessionId: sessionId,
      deltaCents,
    },
    origin,
  );
  if (!checkout.ok) {
    console.error("[bundle-upgrade] Stripe Checkout Session failed", {
      session_id: sessionId,
      status: checkout.status,
      error: checkout.error,
    });
    return NextResponse.json(
      { error: "Could not start the bundle upgrade. Please try again." },
      { status: 502 },
    );
  }

  // Best-effort: stamp the original lead with the bundle session id so the
  // webhook can correlate when the delta payment intent arrives.
  // Webhook will re-look-up by client_reference_id either way.
  const sessionIdFromUrl = new URL(checkout.url).pathname;
  // The hosted checkout URL doesn't contain the session id; we'll PATCH after
  // the webhook fires with the canonical id. Skip the optimistic stamp.
  void sessionIdFromUrl;
  const stamp = await recordBundleUpgradeSession({
    leadId,
    bundleSessionId: "pending",
  });
  if (!stamp.ok) {
    console.warn("[bundle-upgrade] failed to stamp lead with pending bundle session", {
      lead_id: leadId,
      status: stamp.status,
      error: stamp.error,
    });
  }

  return NextResponse.json({ checkout_url: checkout.url });
}
