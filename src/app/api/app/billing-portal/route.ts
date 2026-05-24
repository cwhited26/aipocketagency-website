import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StripePortalSession = { url: string };

export async function GET(req: NextRequest): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/app/login", req.url));
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }

  // Look up the Stripe customer ID for this user
  const supabaseUrl = (
    process.env.POCKET_AGENT_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.WC_ADMIN_SUPABASE_URL ??
    ""
  ).replace(/\/$/, "");
  const supabaseKey =
    process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.WC_ADMIN_SUPABASE_SERVICE_KEY ??
    "";

  let stripeCustomerId: string | null = null;
  if (supabaseUrl && supabaseKey) {
    const subRes = await fetch(
      `${supabaseUrl}/rest/v1/pocket_agent_subscriptions?user_id=eq.${encodeURIComponent(user.id)}&limit=1&select=stripe_customer_id`,
      {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
        cache: "no-store",
      },
    );
    if (subRes.ok) {
      const rows = (await subRes.json()) as Array<{ stripe_customer_id?: string }>;
      stripeCustomerId = rows[0]?.stripe_customer_id ?? null;
    }
  }

  if (!stripeCustomerId) {
    // No subscription found — redirect to marketing page
    return NextResponse.redirect(new URL("/pocket-agent?expired=true", req.url));
  }

  const origin = new URL(req.url).origin;
  const body = new URLSearchParams({
    customer: stripeCustomerId,
    return_url: `${origin}/app/settings`,
  });

  const portalRes = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!portalRes.ok) {
    return NextResponse.json({ error: "Failed to create billing portal" }, { status: 502 });
  }

  const portal = (await portalRes.json()) as StripePortalSession;
  return NextResponse.redirect(portal.url);
}
