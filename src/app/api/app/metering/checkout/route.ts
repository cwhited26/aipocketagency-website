// POST /api/app/metering/checkout — start a Stripe one-time charge for a Top Up bundle
// (PA-POS-30, studio_plus/enterprise only) or a Project Pass (PA-POS-31, lower tiers renting a
// gated App). Signed-in owners only; direct Stripe REST (no SDK — repo rule); the webhook
// (metadata source=pa_metering) writes the entitlement row on completion.
//
// Customer autonomy (the PA-POS-31 amendment): this route never counts prior purchases. The 3rd
// rental of the same App goes through the same door at the same price as the 1st.

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getTopUpBundle, isTopUpBundleId } from "@/data/top-ups";
import { getPassDef, isPassAppSlug, passPriceCents } from "@/data/project-passes";
import { getCurrentTier } from "@/lib/personas/tier-caps";
import { tierGetsCredits } from "@/lib/metering/credits";
import { tierIncludesApp } from "@/lib/metering/passes";
import {
  buildProjectPassCheckoutParams,
  buildTopUpCheckoutParams,
} from "@/lib/metering/checkout-params";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STRIPE_VERSION = "2024-09-30.acacia";

// Boundary validation: exactly one of the two purchase shapes.
const BodySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("top_up"), bundle_id: z.string() }),
  z.object({ kind: z.literal("project_pass"), app_slug: z.string() }),
]);

export async function POST(req: Request): Promise<NextResponse> {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    console.error("[metering/checkout] STRIPE_SECRET_KEY not set");
    return NextResponse.json({ error: "server misconfigured" }, { status: 500 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Unknown product" }, { status: 400 });
  }

  const tier = await getCurrentTier(user.id);
  const origin = new URL(req.url).origin;
  const common = {
    origin,
    userId: user.id,
    email: user.email ?? null,
    tier,
  };

  let params: URLSearchParams;
  if (parsed.data.kind === "top_up") {
    // Hard rule (PA-POS-30): Top Ups exist for studio_plus / enterprise only. An entry-tier
    // request here is a bug or a hand-rolled call — refuse honestly, never upsell credits down-tier.
    if (!tierGetsCredits(tier)) {
      return NextResponse.json(
        { error: "Top Ups are part of the AI Agent Workspace and Enterprise plans." },
        { status: 403 },
      );
    }
    if (!isTopUpBundleId(parsed.data.bundle_id)) {
      return NextResponse.json({ error: "Unknown product" }, { status: 400 });
    }
    const bundle = getTopUpBundle(parsed.data.bundle_id);
    if (!bundle) return NextResponse.json({ error: "Unknown product" }, { status: 400 });
    params = buildTopUpCheckoutParams({
      ...common,
      bundle,
      successPath: "/app/apps?topup=purchased",
      cancelPath: "/app/apps",
    });
  } else {
    if (!isPassAppSlug(parsed.data.app_slug)) {
      return NextResponse.json({ error: "Unknown product" }, { status: 400 });
    }
    const def = getPassDef(parsed.data.app_slug);
    if (!def) return NextResponse.json({ error: "Unknown product" }, { status: 400 });
    // A tier that already includes the App has nothing to rent — refuse rather than double-charge.
    if (tierIncludesApp(tier, def.appSlug)) {
      return NextResponse.json(
        { error: `${def.label} is already included in your plan.` },
        { status: 409 },
      );
    }
    params = buildProjectPassCheckoutParams({
      ...common,
      def,
      priceCents: passPriceCents(def, tier),
      successPath: `${def.appHref}?pass=purchased`,
      cancelPath: def.appHref,
    });
  }

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
    console.error("[metering/checkout] Stripe session creation failed", {
      kind: parsed.data.kind,
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
    console.error("[metering/checkout] Stripe response missing url", { kind: parsed.data.kind });
    return NextResponse.json({ error: "Could not start checkout." }, { status: 502 });
  }
  return NextResponse.json({ checkout_url: data.url });
}
