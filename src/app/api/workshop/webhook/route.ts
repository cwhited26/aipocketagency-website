// POST /api/workshop/webhook — the workshop's own Stripe webhook endpoint (PA-POS-38). Chase
// points a second Stripe webhook endpoint here subscribed to checkout.session.completed; its
// signing secret is STRIPE_WORKSHOP_WEBHOOK_SECRET (falls back to STRIPE_WEBHOOK_SECRET when the
// same endpoint secret is reused). Sessions from other funnels pass through as 200 no-ops — the
// main webhook owns them.

import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyWorkshopStripeSignature } from "@/lib/workshop/stripe";
import { WORKSHOP_CHECKOUT_SOURCE } from "@/lib/workshop/product";
import { handleWorkshopCheckoutCompleted } from "@/lib/workshop/provision";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const eventSchema = z.object({
  id: z.string(),
  type: z.string(),
  data: z.object({
    object: z.object({
      id: z.string(),
      customer: z.string().nullish(),
      metadata: z.record(z.string(), z.string()).nullish(),
    }),
  }),
});

export async function POST(req: Request): Promise<NextResponse> {
  const secret =
    process.env.STRIPE_WORKSHOP_WEBHOOK_SECRET ?? process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[workshop/webhook] no webhook signing secret set", {});
    return NextResponse.json({ error: "server misconfigured" }, { status: 500 });
  }

  const rawBody = await req.text();
  const verified = verifyWorkshopStripeSignature(
    rawBody,
    req.headers.get("stripe-signature"),
    secret,
  );
  if (!verified.ok) {
    console.error("[workshop/webhook] signature verification failed", {
      reason: verified.reason,
    });
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  let raw: unknown;
  try {
    raw = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }
  const parsed = eventSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "unrecognized event shape" }, { status: 422 });
  }
  const event = parsed.data;

  if (
    event.type !== "checkout.session.completed" &&
    event.type !== "checkout.session.async_payment_succeeded"
  ) {
    return NextResponse.json({ received: true, ignored: event.type });
  }

  const session = event.data.object;
  if (session.metadata?.source !== WORKSHOP_CHECKOUT_SOURCE) {
    return NextResponse.json({ received: true, ignored: "non-workshop session" });
  }

  const outcome = await handleWorkshopCheckoutCompleted({
    id: session.id,
    customer: session.customer ?? null,
    metadata: session.metadata ?? null,
  });
  if (!outcome.ok) {
    // 500 so Stripe retries — every step inside the handler is idempotent.
    console.error("[workshop/webhook] provisioning failed", {
      event_id: event.id,
      session_id: session.id,
      error: outcome.error,
    });
    return NextResponse.json({ error: "provisioning failed" }, { status: 500 });
  }

  return NextResponse.json({
    received: true,
    registration_id: outcome.registrationId,
    emails_enqueued: outcome.emailsEnqueued,
  });
}
