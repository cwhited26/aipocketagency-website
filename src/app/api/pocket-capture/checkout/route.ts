import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { buildPocketCaptureCheckoutParams } from "@/lib/pocket-capture/checkout";
import { POCKET_CAPTURE_PRICE_CENTS } from "@/lib/pocket-capture/product";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Boundary validation. The Pocket Capture standalone funnel is an impulse buy, so the only field the
// order form collects is the buyer's email (lowercased + trimmed) — there is no prior session or tier.
const BodySchema = z.object({
  email: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
    z.string().email(),
  ),
});

const STRIPE_VERSION = "2024-09-30.acacia";

export async function POST(req: Request): Promise<NextResponse> {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    console.error("[pocket-capture/checkout] STRIPE_SECRET_KEY not set");
    return NextResponse.json({ error: "server misconfigured" }, { status: 500 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }
  const email = parsed.data.email;

  // Thread the signed-in user id when present (rare for this top-of-funnel buy) so the webhook can link
  // the ledger row to the account immediately instead of waiting for the email-claim on first login.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const origin = new URL(req.url).origin;
  const params = buildPocketCaptureCheckoutParams({
    origin,
    email,
    userId: user?.id ?? null,
  });

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": STRIPE_VERSION,
    },
    body: params.toString(),
    cache: "no-store",
  });

  if (!res.ok) {
    const error = await res.text();
    console.error("[pocket-capture/checkout] Stripe session creation failed", {
      amount_cents: POCKET_CAPTURE_PRICE_CENTS,
      status: res.status,
      error,
    });
    return NextResponse.json(
      { error: "Could not start checkout. Please try again." },
      { status: 502 },
    );
  }

  const data = (await res.json()) as { url?: string };
  if (!data.url) {
    console.error("[pocket-capture/checkout] Stripe response missing url");
    return NextResponse.json({ error: "Could not start checkout." }, { status: 502 });
  }
  return NextResponse.json({ url: data.url });
}
