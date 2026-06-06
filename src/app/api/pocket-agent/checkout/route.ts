import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { resolveCheckoutTier, type PaidTier } from "@/lib/personas/tier-caps";
import {
  buildPocketAgentCheckoutParams,
  priceIdForCheckout,
} from "@/lib/pocket-agent-checkout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Zod boundary: validate the POST body. `tier` is the SMB ladder param routed from the
// /pricing CTAs (/start?tier=pro …). It's intentionally permissive here (z.string) —
// resolveCheckoutTier does the real validation and defaults to 'starter'.
const BodySchema = z.object({
  email: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
    z.string().email(),
  ),
  name: z
    .preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string())
    .optional(),
  tier: z.string().optional(),
});

type CheckoutResult =
  | { ok: true; url: string; sessionId: string }
  | { ok: false; status: number; error: string };

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

async function createPocketAgentCheckout(args: {
  email: string;
  name: string;
  tier: PaidTier;
  origin: string;
  userId: string | null;
}): Promise<CheckoutResult> {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return { ok: false, status: 500, error: "STRIPE_SECRET_KEY not set" };
  }
  const priceId = priceIdForCheckout(args.tier);
  if (!priceId) {
    return {
      ok: false,
      status: 500,
      error: `No Stripe price configured for tier '${args.tier}'`,
    };
  }

  const params = buildPocketAgentCheckoutParams({
    email: args.email,
    name: args.name,
    tier: args.tier,
    priceId,
    origin: args.origin,
    userId: args.userId,
  });

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": "2024-09-30.acacia",
    },
    body: params.toString(),
    cache: "no-store",
  });

  if (!res.ok) {
    const error = await res.text();
    return { ok: false, status: res.status, error };
  }

  const data = (await res.json()) as { id?: string; url?: string };
  if (!data.url || !data.id) {
    return { ok: false, status: 500, error: "Stripe response missing url/id" };
  }
  return { ok: true, url: data.url, sessionId: data.id };
}

export async function POST(req: Request): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return badRequest("Valid email required");
  }

  const email = parsed.data.email;
  const name = parsed.data.name ?? "";
  const tier = resolveCheckoutTier(parsed.data.tier);

  // Read auth from session cookie — null when not logged in (still allowed).
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const origin = new URL(req.url).origin;
  const checkout = await createPocketAgentCheckout({
    email,
    name,
    tier,
    origin,
    userId: user?.id ?? null,
  });

  if (!checkout.ok) {
    console.error("[pocket-agent/checkout] Stripe session creation failed", {
      tier,
      status: checkout.status,
      error: checkout.error,
    });
    return NextResponse.json(
      { error: "Could not start checkout. Please try again." },
      { status: 502 },
    );
  }

  return NextResponse.json({ checkout_url: checkout.url });
}
