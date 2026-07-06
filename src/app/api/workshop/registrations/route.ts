// POST /api/workshop/registrations — create a workshop registration + its Stripe Checkout Session
// (PA-POS-38). The order form posts email + name + slot + timezone + the bump checkbox; the
// response carries the Stripe-hosted checkout URL. mode=subscription, trial_period_days=30, the
// $97 workshop (+ optional $27 bump) charged today via add_invoice_items.

import { NextResponse } from "next/server";
import { z } from "zod";
import { insertWorkshopRegistration } from "@/lib/workshop/db";
import {
  buildWorkshopCheckoutParams,
  workshopSubscriptionPriceId,
} from "@/lib/workshop/product";
import { createWorkshopCheckoutSession } from "@/lib/workshop/stripe";
import { isValidSlot, safeTimeZone } from "@/lib/workshop/slots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.string().email().max(320),
  name: z.string().max(120).optional().default(""),
  slot_at: z.string().min(10).max(64),
  timezone: z.string().min(1).max(64),
  bump: z.boolean().default(false),
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
  const body = parsed.data;

  if (!isValidSlot(body.slot_at, Date.now())) {
    return NextResponse.json(
      { error: "That session time has passed or is outside the booking window. Pick another slot." },
      { status: 422 },
    );
  }

  const priceId = workshopSubscriptionPriceId();
  if (!priceId) {
    console.error("[workshop/registrations] no Stripe price configured for the pro tier", {});
    return NextResponse.json({ error: "server misconfigured" }, { status: 500 });
  }

  const slotIso = new Date(Date.parse(body.slot_at)).toISOString();
  const registration = await insertWorkshopRegistration({
    email: body.email.trim().toLowerCase(),
    name: body.name.trim() || null,
    chosenSlotAt: slotIso,
    timezone: safeTimeZone(body.timezone),
    bumpSelected: body.bump,
  });
  if (!registration.ok) {
    console.error("[workshop/registrations] insert failed", {
      status: registration.status,
      error: registration.error,
    });
    return NextResponse.json({ error: "could not create registration" }, { status: 502 });
  }

  const origin = process.env.PA_OAUTH_REDIRECT_BASE ?? "https://aipocketagent.com";
  const params = buildWorkshopCheckoutParams({
    email: registration.data.email,
    name: registration.data.name ?? "",
    registrationId: registration.data.id,
    priceId,
    origin: origin.replace(/\/+$/, ""),
    bump: body.bump,
  });

  const session = await createWorkshopCheckoutSession(params);
  if (!session.ok || !session.data.url) {
    console.error("[workshop/registrations] checkout session creation failed", {
      registration_id: registration.data.id,
      status: session.ok ? 502 : session.status,
      error: session.ok ? "no url on session" : session.error,
    });
    return NextResponse.json({ error: "could not start checkout" }, { status: 502 });
  }

  return NextResponse.json({
    registration_id: registration.data.id,
    checkout_url: session.data.url,
  });
}
