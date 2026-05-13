import { NextResponse } from "next/server";
import {
  createBundleCheckout,
  createKitCheckout,
} from "@/lib/stripe-checkout";
import {
  fetchLeadFunnelById,
  markApaLeadCheckoutStatus,
} from "@/lib/wc-admin-supabase";
import {
  BUNDLE_PRICING,
  getKitConfig,
  isKitSlug,
} from "@/lib/kit-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type BodyShape = {
  lead_id?: unknown;
  pair?: unknown;
  bundle?: unknown;
};

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

/**
 * Final step of the inline funnel.
 *
 * Reads the buyer's pair + bundle selections from the request body, looks
 * up the lead row (validates it exists + matches the original kit slug),
 * and mints the appropriate Stripe Checkout Session:
 *
 *   bundle=true                → single $47 line item (bundle_upgrade)
 *   bundle=false, pair=true    → $15 kit + $10 bump line items
 *   bundle=false, pair=false   → $15 kit line item only
 *
 * The pair pairing comes from `kit-config.bumpTarget` server-side; the
 * client cannot smuggle in an arbitrary bump kit.
 */
export async function POST(req: Request): Promise<NextResponse> {
  let body: BodyShape;
  try {
    body = (await req.json()) as BodyShape;
  } catch {
    return badRequest("Invalid JSON");
  }

  const leadId = typeof body.lead_id === "string" ? body.lead_id.trim() : "";
  const pair = body.pair === true;
  const bundle = body.bundle === true;

  if (!UUID_V4_RE.test(leadId)) {
    return badRequest("Invalid lead id");
  }

  const lookup = await fetchLeadFunnelById(leadId);
  if (!lookup.ok) {
    console.error("[funnel/checkout] failed to load lead", {
      lead_id: leadId,
      status: lookup.status,
      error: lookup.error,
    });
    return NextResponse.json(
      { error: "Could not load your selection. Please refresh and try again." },
      { status: 502 },
    );
  }
  if (!lookup.lead) {
    return NextResponse.json({ error: "Unknown lead" }, { status: 404 });
  }
  const lead = lookup.lead;
  if (!isKitSlug(lead.source)) {
    console.error("[funnel/checkout] lead has non-kit source", {
      lead_id: leadId,
      source: lead.source,
    });
    return NextResponse.json(
      { error: "Lead source is not a valid kit." },
      { status: 422 },
    );
  }
  const primaryKit = getKitConfig(lead.source);
  if (!primaryKit) {
    return NextResponse.json({ error: "Unknown kit" }, { status: 422 });
  }
  if (!lead.email) {
    return NextResponse.json(
      { error: "Lead is missing email — please refill the form." },
      { status: 422 },
    );
  }

  const origin = new URL(req.url).origin;

  if (bundle) {
    const checkout = await createBundleCheckout(
      {
        leadId,
        email: lead.email,
        originSlug: primaryKit.slug,
        unitAmountCents: BUNDLE_PRICING.offerUsd * 100,
      },
      origin,
    );
    if (!checkout.ok) {
      console.error("[funnel/checkout] bundle Stripe Checkout Session failed", {
        lead_id: leadId,
        status: checkout.status,
        error: checkout.error,
      });
      return NextResponse.json(
        { error: "Could not start bundle checkout. Please try again." },
        { status: 502 },
      );
    }
    const stamp = await markApaLeadCheckoutStatus({
      leadId,
      status: "pending",
      stripeSessionId: checkout.sessionId,
    });
    if (!stamp.ok) {
      console.error("[funnel/checkout] failed to stamp pending checkout (bundle)", {
        lead_id: leadId,
        session_id: checkout.sessionId,
        status: stamp.status,
        error: stamp.error,
      });
    }
    return NextResponse.json({ checkout_url: checkout.url });
  }

  const checkout = await createKitCheckout(
    {
      leadId,
      email: lead.email,
      name: lead.name ?? "",
      phone: "",
      source: primaryKit.slug,
      bumpSlug: pair ? primaryKit.bumpTarget : undefined,
    },
    origin,
  );
  if (!checkout.ok) {
    console.error("[funnel/checkout] primary Stripe Checkout Session failed", {
      lead_id: leadId,
      status: checkout.status,
      error: checkout.error,
    });
    return NextResponse.json(
      { error: "Could not start checkout. Please try again." },
      { status: 502 },
    );
  }
  const stamp = await markApaLeadCheckoutStatus({
    leadId,
    status: "pending",
    stripeSessionId: checkout.sessionId,
  });
  if (!stamp.ok) {
    console.error("[funnel/checkout] failed to stamp pending checkout (primary)", {
      lead_id: leadId,
      session_id: checkout.sessionId,
      status: stamp.status,
      error: stamp.error,
    });
  }
  return NextResponse.json({ checkout_url: checkout.url });
}
