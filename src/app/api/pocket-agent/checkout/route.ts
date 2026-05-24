import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type BodyShape = {
  email?: unknown;
  name?: unknown;
};

type CheckoutResult =
  | { ok: true; url: string; sessionId: string }
  | { ok: false; status: number; error: string };

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

async function createPocketAgentCheckout(args: {
  email: string;
  name: string;
  origin: string;
  userId: string | null;
}): Promise<CheckoutResult> {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return { ok: false, status: 500, error: "STRIPE_SECRET_KEY not set" };
  }
  const priceId = process.env.STRIPE_POCKET_AGENT_PRICE_ID;
  if (!priceId) {
    return { ok: false, status: 500, error: "STRIPE_POCKET_AGENT_PRICE_ID not set" };
  }

  const params = new URLSearchParams();
  params.set("mode", "subscription");
  params.set("customer_email", args.email);
  params.set("line_items[0][price]", priceId);
  params.set("line_items[0][quantity]", "1");
  params.set("subscription_data[trial_period_days]", "14");
  params.set("subscription_data[metadata][email]", args.email);
  params.set("subscription_data[metadata][source]", "pocket_agent");
  if (args.name) {
    params.set("subscription_data[metadata][name]", args.name);
  }
  // When the user is authenticated, embed their id so the webhook can link
  // the subscription row to their account immediately on creation.
  if (args.userId) {
    params.set("client_reference_id", args.userId);
    params.set("subscription_data[metadata][user_id]", args.userId);
  }
  params.set("metadata[email]", args.email);
  params.set("metadata[source]", "pocket_agent");
  if (args.name) {
    params.set("metadata[name]", args.name);
  }
  params.set(
    "success_url",
    `${args.origin}/pocket-agent/welcome?session_id={CHECKOUT_SESSION_ID}`,
  );
  params.set("cancel_url", `${args.origin}/pocket-agent`);

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
  let body: BodyShape;
  try {
    body = (await req.json()) as BodyShape;
  } catch {
    return badRequest("Invalid JSON");
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";

  if (!email || !EMAIL_RE.test(email)) {
    return badRequest("Valid email required");
  }

  // Read auth from session cookie — null when not logged in (still allowed).
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const origin = new URL(req.url).origin;
  const checkout = await createPocketAgentCheckout({
    email,
    name,
    origin,
    userId: user?.id ?? null,
  });

  if (!checkout.ok) {
    console.error("[pocket-agent/checkout] Stripe session creation failed", {
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
