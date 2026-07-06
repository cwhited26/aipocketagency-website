// POST /api/workshop/oto/[n] — the one-yes/one-no OTO decisions (PA-POS-38 §24.3). A yes charges
// the payment method the workshop checkout saved (off-session PaymentIntent — no card re-entry);
// a no records the decline. n=1 → $997 Setup Sprint (ledgered in the shipped
// pocket_agent_addon_purchases with kind='setup_sprint' + the DWY email sequence); n=2 → $297
// Backstage Pass (pa_backstage_passes lifetime grant). Both write pa_workshop_oto_purchases.

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getWorkshopRegistrationBySession,
  insertBackstagePass,
  upsertWorkshopOtoPurchase,
} from "@/lib/workshop/db";
import { otoMeta, type WorkshopOtoNumber } from "@/lib/workshop/product";
import {
  chargeWorkshopOto,
  resolveSavedPaymentMethod,
  retrieveWorkshopCheckoutSession,
} from "@/lib/workshop/stripe";
import { insertPocketAgentAddonPurchase } from "@/lib/pocket-agent-supabase";
import { enqueueDwy } from "@/lib/emails/enqueue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  session_id: z.string().min(8).max(200),
  accept: z.boolean(),
});

function parseOtoNumber(n: string): WorkshopOtoNumber | null {
  if (n === "1") return 1;
  if (n === "2") return 2;
  return null;
}

export async function POST(
  req: Request,
  { params }: { params: { n: string } },
): Promise<NextResponse> {
  const oto = parseOtoNumber(params.n);
  if (!oto) {
    return NextResponse.json({ error: "unknown offer" }, { status: 404 });
  }

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
  const { session_id, accept } = parsed.data;

  // The registration is stamped with the session id by the webhook. If the webhook hasn't landed
  // yet (buyer beat it to the OTO page), fall back to the session's own metadata.
  let registration = await getWorkshopRegistrationBySession(session_id);
  if (!registration.ok) {
    console.error("[workshop/oto] registration lookup failed", {
      session_id,
      status: registration.status,
      error: registration.error,
    });
    return NextResponse.json({ error: "lookup failed" }, { status: 502 });
  }

  const session = await retrieveWorkshopCheckoutSession(session_id);
  if (!session.ok) {
    console.error("[workshop/oto] stripe session retrieve failed", {
      session_id,
      status: session.status,
      error: session.error,
    });
    return NextResponse.json({ error: "unknown checkout session" }, { status: 404 });
  }

  const registrationId =
    registration.data?.id ?? session.data.metadata?.registration_id ?? null;
  if (!registrationId) {
    return NextResponse.json({ error: "no registration for this session" }, { status: 404 });
  }
  const ownerId = registration.data?.owner_id ?? null;
  const email = registration.data?.email ?? null;
  const meta = otoMeta(oto);

  if (!accept) {
    const declined = await upsertWorkshopOtoPurchase({
      registrationId,
      otoNumber: oto,
      productSlug: meta.slug,
      amountCents: meta.amountCents,
      stripePaymentIntentId: null,
      status: "declined",
    });
    if (!declined.ok) {
      console.error("[workshop/oto] decline record failed", {
        registration_id: registrationId,
        oto,
        status: declined.status,
        error: declined.error,
      });
    }
    return NextResponse.json({ ok: true, charged: false });
  }

  const customerId = session.data.customer;
  if (!customerId) {
    return NextResponse.json({ error: "no customer on session" }, { status: 409 });
  }

  const pm = await resolveSavedPaymentMethod({
    customerId,
    subscriptionId: session.data.subscription,
  });
  if (!pm.ok) {
    console.error("[workshop/oto] no saved payment method", {
      registration_id: registrationId,
      oto,
      status: pm.status,
      error: pm.error,
    });
    return NextResponse.json(
      { error: "We couldn't find your saved card. Your workshop seat is unaffected." },
      { status: 409 },
    );
  }

  const charge = await chargeWorkshopOto({
    oto,
    customerId,
    paymentMethodId: pm.data,
    registrationId,
  });

  if (!charge.ok || charge.data.status !== "succeeded") {
    const failRecord = await upsertWorkshopOtoPurchase({
      registrationId,
      otoNumber: oto,
      productSlug: meta.slug,
      amountCents: meta.amountCents,
      stripePaymentIntentId: charge.ok ? charge.data.id : null,
      status: "failed",
    });
    if (!failRecord.ok) {
      console.error("[workshop/oto] failed-charge record failed", {
        registration_id: registrationId,
        oto,
        status: failRecord.status,
        error: failRecord.error,
      });
    }
    console.error("[workshop/oto] charge failed", {
      registration_id: registrationId,
      oto,
      status: charge.ok ? 402 : charge.status,
      error: charge.ok ? charge.data.last_payment_error?.message : charge.error,
    });
    return NextResponse.json(
      { error: "The charge didn't go through. Your workshop seat is unaffected." },
      { status: 402 },
    );
  }

  const record = await upsertWorkshopOtoPurchase({
    registrationId,
    otoNumber: oto,
    productSlug: meta.slug,
    amountCents: meta.amountCents,
    stripePaymentIntentId: charge.data.id,
    status: "succeeded",
  });
  if (!record.ok) {
    console.error("[workshop/oto] success record failed", {
      registration_id: registrationId,
      oto,
      status: record.status,
      error: record.error,
    });
  }

  if (oto === 1) {
    // The shipped Setup Sprint ledger. The synthetic session key keeps the row idempotent per
    // PaymentIntent without colliding with the checkout session's UNIQUE stripe_session_id.
    const ledger = await insertPocketAgentAddonPurchase({
      userId: ownerId,
      email,
      kind: "setup_sprint",
      stripeSessionId: `wkshp_oto1:${charge.data.id}`,
      stripeCustomerId: customerId,
      stripePaymentIntentId: charge.data.id,
      amountCents: meta.amountCents,
    });
    if (!ledger.ok) {
      console.error("[workshop/oto] setup_sprint addon ledger failed", {
        registration_id: registrationId,
        status: ledger.status,
        error: ledger.error,
      });
    }
    if (email) {
      const emails = await enqueueDwy({ ownerId, email, firstName: registration.data?.name }, "standard");
      if (!emails.ok) {
        console.error("[workshop/oto] dwy sequence enqueue failed", {
          registration_id: registrationId,
          error: emails.error,
        });
      }
    }
  } else {
    const pass = await insertBackstagePass({
      ownerId,
      registrationId,
      stripePaymentIntentId: charge.data.id,
    });
    if (!pass.ok) {
      console.error("[workshop/oto] backstage pass insert failed", {
        registration_id: registrationId,
        status: pass.status,
        error: pass.error,
      });
      return NextResponse.json({ error: "grant failed after charge" }, { status: 502 });
    }
  }

  return NextResponse.json({ ok: true, charged: true, payment_intent_id: charge.data.id });
}
